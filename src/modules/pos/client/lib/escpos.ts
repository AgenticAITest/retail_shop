/**
 * ESC/POS Command Builder
 *
 * Pure utility — builds byte arrays for ESC/POS thermal printers.
 * No browser APIs used here; output is a Uint8Array sent via PrinterManager.
 *
 * Supported printers: Epson TM-T82/T82X/TMU-220B, Star TSP645II,
 * Iware MP-58II/MP-58R, VSC TM-58D, Kassen models.
 */

// ESC/POS command constants
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const NUL = 0x00;

export class EscPosBuilder {
  private buffer: number[] = [];

  /** Reset printer to default settings */
  initialize(): this {
    this.buffer.push(ESC, 0x40); // ESC @
    return this;
  }

  /** Encode and append text (CP437 compatible — ASCII subset) */
  text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      this.buffer.push(code < 256 ? code : 0x3f); // '?' for unmappable
    }
    return this;
  }

  /** Line feed */
  lineFeed(n: number = 1): this {
    for (let i = 0; i < n; i++) {
      this.buffer.push(LF);
    }
    return this;
  }

  /** New line (alias for text + LF) */
  line(str: string): this {
    return this.text(str).lineFeed();
  }

  /** Set bold mode */
  bold(on: boolean = true): this {
    this.buffer.push(ESC, 0x45, on ? 1 : 0); // ESC E n
    return this;
  }

  /** Set double height */
  doubleHeight(on: boolean = true): this {
    // GS ! n — bit 4 = double height
    if (on) {
      this.buffer.push(GS, 0x21, 0x10);
    } else {
      this.buffer.push(GS, 0x21, 0x00);
    }
    return this;
  }

  /** Set double width */
  doubleWidth(on: boolean = true): this {
    // GS ! n — bit 5 = double width
    if (on) {
      this.buffer.push(GS, 0x21, 0x20);
    } else {
      this.buffer.push(GS, 0x21, 0x00);
    }
    return this;
  }

  /** Set bold + double height + double width */
  large(on: boolean = true): this {
    if (on) {
      this.buffer.push(GS, 0x21, 0x30); // double width + double height
      this.buffer.push(ESC, 0x45, 1);    // bold
    } else {
      this.buffer.push(GS, 0x21, 0x00);
      this.buffer.push(ESC, 0x45, 0);
    }
    return this;
  }

  /** Set underline */
  underline(on: boolean = true): this {
    this.buffer.push(ESC, 0x2d, on ? 1 : 0); // ESC - n
    return this;
  }

  /** Set text alignment */
  align(alignment: 'left' | 'center' | 'right'): this {
    const n = alignment === 'left' ? 0 : alignment === 'center' ? 1 : 2;
    this.buffer.push(ESC, 0x61, n); // ESC a n
    return this;
  }

  /** Print a separator line */
  separator(char: string = '-', width: number = 48): this {
    return this.line(char.repeat(width));
  }

  /** Print two-column text (left-aligned left, right-aligned right) */
  leftRight(left: string, right: string, width: number = 48): this {
    const spaces = width - left.length - right.length;
    if (spaces > 0) {
      return this.line(left + ' '.repeat(spaces) + right);
    }
    // If too long, truncate left side
    const maxLeft = width - right.length - 1;
    return this.line(left.substring(0, maxLeft) + ' ' + right);
  }

  /** Print Code128 barcode */
  barcode(data: string): this {
    // GS k m d1...dk NUL — Code128 (type 73)
    this.align('center');
    // Set barcode height
    this.buffer.push(GS, 0x68, 60); // GS h n (height = 60 dots)
    // Set barcode width
    this.buffer.push(GS, 0x77, 2); // GS w n (width multiplier = 2)
    // Set HRI position below barcode
    this.buffer.push(GS, 0x48, 2); // GS H n (below)
    // Print barcode: GS k 73 n data
    this.buffer.push(GS, 0x6b, 73, data.length);
    for (let i = 0; i < data.length; i++) {
      this.buffer.push(data.charCodeAt(i));
    }
    this.lineFeed(2);
    this.align('left');
    return this;
  }

  /** Full paper cut */
  cut(): this {
    this.lineFeed(3);
    this.buffer.push(GS, 0x56, 0x00); // GS V 0 (full cut)
    return this;
  }

  /** Partial paper cut */
  partialCut(): this {
    this.lineFeed(3);
    this.buffer.push(GS, 0x56, 0x01); // GS V 1 (partial cut)
    return this;
  }

  /** Open cash drawer (kick pulse) */
  openDrawer(): this {
    // ESC p m t1 t2 — pin 2, pulse on/off times
    this.buffer.push(ESC, 0x70, 0, 25, 250);
    return this;
  }

  /** Build and return the final byte array */
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }

  /** Get buffer length */
  get length(): number {
    return this.buffer.length;
  }
}

/**
 * Paper width configurations
 */
export const PAPER_WIDTHS = {
  '58mm': { chars: 32, name: '58mm (32 chars)' },
  '80mm': { chars: 48, name: '80mm (48 chars)' },
} as const;

export type PaperWidth = keyof typeof PAPER_WIDTHS;
