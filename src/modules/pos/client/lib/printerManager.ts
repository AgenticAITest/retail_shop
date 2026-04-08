/**
 * Printer Manager Service
 *
 * Abstraction layer over WebUSB and WebSerial APIs for ESC/POS thermal printers.
 * Singleton pattern — one printer connection per POS session.
 *
 * Supported printers:
 * - Epson TM-T82 / TM-T82X / TMU-220B (USB)
 * - Star Micronics TSP645II (USB)
 * - Iware MP-58II / MP-58R (USB)
 * - VSC TM-58D (USB)
 * - Kassen models (USB)
 *
 * Chrome-only: WebUSB and WebSerial require Chrome/Chromium.
 */

// WebUSB / WebSerial type declarations (not in default TS lib)
declare global {
  interface Navigator {
    usb: {
      requestDevice(options: { filters: Array<{ vendorId?: number }> }): Promise<any>;
    };
    serial: {
      requestPort(): Promise<any>;
    };
  }
}

import { buildReceiptCommands } from './receiptTemplate';
import type { PaperWidth } from './escpos';

export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'printing' | 'error';
export type PrinterInterface = 'usb' | 'serial';

interface PrinterConfig {
  paperWidth: PaperWidth;
  interface: PrinterInterface;
  maxRetries: number;
}

const DEFAULT_CONFIG: PrinterConfig = {
  paperWidth: '80mm',
  interface: 'usb',
  maxRetries: 3,
};

class PrinterManagerClass {
  private status: PrinterStatus = 'disconnected';
  private usbDevice: any | null = null;
  private serialPort: any | null = null;
  private serialWriter: any | null = null;
  private config: PrinterConfig;
  private statusListeners: Set<(status: PrinterStatus) => void> = new Set();
  private errorListeners: Set<(error: string) => void> = new Set();

  constructor() {
    // Load config from localStorage
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('pos_printer_config') : null;
    this.config = saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
  }

  /** Check if browser supports WebUSB or WebSerial */
  isSupported(): boolean {
    return this.isUsbSupported() || this.isSerialSupported();
  }

  isUsbSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  isSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  /** Check if running in Chrome/Chromium */
  isChrome(): boolean {
    if (typeof navigator === 'undefined') return false;
    return /Chrome/.test(navigator.userAgent) && !/Edge|Edg/.test(navigator.userAgent);
  }

  getStatus(): PrinterStatus {
    return this.status;
  }

  getConfig(): PrinterConfig {
    return { ...this.config };
  }

  setPaperWidth(width: PaperWidth): void {
    this.config.paperWidth = width;
    this.saveConfig();
  }

  setInterface(iface: PrinterInterface): void {
    this.config.interface = iface;
    this.saveConfig();
  }

  onStatusChange(listener: (status: PrinterStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onError(listener: (error: string) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private setStatus(status: PrinterStatus): void {
    this.status = status;
    this.statusListeners.forEach(l => l(status));
  }

  private emitError(error: string): void {
    this.errorListeners.forEach(l => l(error));
  }

  private saveConfig(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('pos_printer_config', JSON.stringify(this.config));
    }
  }

  /** Connect to a printer */
  async connect(): Promise<boolean> {
    this.setStatus('connecting');

    try {
      if (this.config.interface === 'usb' && this.isUsbSupported()) {
        return await this.connectUsb();
      } else if (this.config.interface === 'serial' && this.isSerialSupported()) {
        return await this.connectSerial();
      } else {
        // Try USB first, then serial
        if (this.isUsbSupported()) {
          try { return await this.connectUsb(); } catch {}
        }
        if (this.isSerialSupported()) {
          return await this.connectSerial();
        }
      }
      this.setStatus('error');
      this.emitError('No supported printer interface available');
      return false;
    } catch (err) {
      this.setStatus('error');
      this.emitError(err instanceof Error ? err.message : 'Failed to connect');
      return false;
    }
  }

  private async connectUsb(): Promise<boolean> {
    const device = await navigator.usb.requestDevice({
      filters: [
        // Epson printers
        { vendorId: 0x04b8 },
        // Star Micronics
        { vendorId: 0x0519 },
        // Generic POS printers
        { vendorId: 0x0fe6 },
        { vendorId: 0x0416 },
        // Allow any printer (user selects)
      ],
    });

    await device.open();
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }
    await device.claimInterface(0);

    this.usbDevice = device;
    this.setStatus('connected');
    return true;
  }

  private async connectSerial(): Promise<boolean> {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });

    this.serialPort = port;
    if (port.writable) {
      this.serialWriter = port.writable.getWriter();
    }

    this.setStatus('connected');
    return true;
  }

  /** Disconnect from printer */
  async disconnect(): Promise<void> {
    try {
      if (this.serialWriter) {
        this.serialWriter.releaseLock();
        this.serialWriter = null;
      }
      if (this.serialPort) {
        await this.serialPort.close().catch(() => {});
        this.serialPort = null;
      }
      if (this.usbDevice) {
        await this.usbDevice.close().catch(() => {});
        this.usbDevice = null;
      }
    } finally {
      this.setStatus('disconnected');
    }
  }

  /** Send raw bytes to printer with retry */
  async print(data: Uint8Array): Promise<boolean> {
    if (this.status !== 'connected') {
      this.emitError('Printer not connected');
      return false;
    }

    this.setStatus('printing');

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        if (this.usbDevice) {
          // Find the OUT endpoint
          const iface = this.usbDevice.configuration?.interfaces?.[0];
          const endpoint = iface?.alternate?.endpoints?.find((e: any) => e.direction === 'out');
          if (endpoint) {
            await this.usbDevice.transferOut(endpoint.endpointNumber, data);
          } else {
            // Fallback: try endpoint 1
            await this.usbDevice.transferOut(1, data);
          }
          this.setStatus('connected');
          return true;
        }

        if (this.serialWriter) {
          await this.serialWriter.write(data);
          this.setStatus('connected');
          return true;
        }

        throw new Error('No active printer connection');
      } catch (err) {
        if (attempt === this.config.maxRetries) {
          this.setStatus('error');
          this.emitError(`Print failed after ${this.config.maxRetries} attempts: ${err instanceof Error ? err.message : String(err)}`);
          return false;
        }
        // Wait before retry
        await new Promise(r => setTimeout(r, 500));
      }
    }

    return false;
  }

  /** High-level: build receipt and print */
  async printReceipt(txnData: any): Promise<boolean> {
    const bytes = buildReceiptCommands(txnData, this.config.paperWidth);
    return this.print(bytes);
  }

  /** Send a test print */
  async testPrint(): Promise<boolean> {
    const { EscPosBuilder } = await import('./escpos');
    const b = new EscPosBuilder();
    b.initialize()
      .align('center')
      .bold(true)
      .line('PRINTER TEST')
      .bold(false)
      .line(`Paper: ${this.config.paperWidth}`)
      .line(`Time: ${new Date().toLocaleString('id-ID')}`)
      .separator()
      .line('Printer is working correctly!')
      .cut();
    return this.print(b.build());
  }
}

// Singleton instance
let instance: PrinterManagerClass | null = null;

export function getPrinterManager(): PrinterManagerClass {
  if (!instance) {
    instance = new PrinterManagerClass();
  }
  return instance;
}
