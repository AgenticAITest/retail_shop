import { Button } from '@client/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@client/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@client/components/ui/select';
import { Label } from '@client/components/ui/label';
import { Printer, AlertTriangle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getPrinterManager, type PrinterStatus as PrinterStatusType } from '../../lib/printerManager';
import { PAPER_WIDTHS, type PaperWidth } from '../../lib/escpos';

export default function PrinterStatus() {
  const pm = getPrinterManager();
  const [status, setStatus] = useState<PrinterStatusType>(pm.getStatus());
  const [config, setConfig] = useState(pm.getConfig());
  const [open, setOpen] = useState(false);
  const isChrome = pm.isChrome();
  const isSupported = pm.isSupported();

  useEffect(() => {
    const unsub = pm.onStatusChange(setStatus);
    const unsubErr = pm.onError((err) => toast.error(`Printer: ${err}`));
    return () => { unsub(); unsubErr(); };
  }, []);

  const handleConnect = useCallback(async () => {
    if (status === 'connected') {
      await pm.disconnect();
    } else {
      await pm.connect();
    }
    setConfig(pm.getConfig());
  }, [status]);

  const handleTestPrint = useCallback(async () => {
    const ok = await pm.testPrint();
    if (ok) toast.success('Test print sent');
  }, []);

  const statusColors: Record<PrinterStatusType, string> = {
    connected: 'text-green-500',
    disconnected: 'text-gray-400',
    connecting: 'text-yellow-500',
    printing: 'text-blue-500',
    error: 'text-red-500',
  };

  return (
    <>
      {/* Chrome-only warning */}
      {!isChrome && (
        <div className="flex items-center gap-1 text-xs text-yellow-600">
          <AlertTriangle size={12} />
          <span>Chrome required for printing</span>
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Printer size={14} className={statusColors[status]} />
            <span className="text-xs capitalize">{status === 'connected' ? 'Printer' : status}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="end">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-medium">Printer</Label>
              <span className={`text-xs font-medium capitalize ${statusColors[status]}`}>{status}</span>
            </div>

            {!isSupported && (
              <p className="text-xs text-yellow-600">
                Printing requires Chrome/Chromium with WebUSB or WebSerial support.
              </p>
            )}

            {/* Paper Width */}
            <div className="space-y-1">
              <Label className="text-xs">Paper Width</Label>
              <Select
                value={config.paperWidth}
                onValueChange={(v: PaperWidth) => { pm.setPaperWidth(v); setConfig(pm.getConfig()); }}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAPER_WIDTHS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>{val.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Interface */}
            <div className="space-y-1">
              <Label className="text-xs">Connection</Label>
              <Select
                value={config.interface}
                onValueChange={(v: 'usb' | 'serial') => { pm.setInterface(v); setConfig(pm.getConfig()); }}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usb">USB</SelectItem>
                  <SelectItem value="serial">Serial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant={status === 'connected' ? 'destructive' : 'default'}
                className="flex-1 h-8"
                onClick={handleConnect}
                disabled={status === 'connecting' || status === 'printing'}
              >
                {status === 'connected' ? 'Disconnect' : 'Connect'}
              </Button>
              {status === 'connected' && (
                <Button size="sm" variant="outline" className="h-8" onClick={handleTestPrint}>
                  Test
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
