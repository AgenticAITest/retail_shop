import { useEffect, useRef, useCallback, useState } from 'react';

interface UseBarcodeOptions {
  onScan: (barcode: string) => void;
  minLength?: number;
  maxGap?: number;
  enabled?: boolean;
}

const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playBeep(frequency: number, duration: number) {
  if (!audioCtx) return;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  gain.gain.value = 0.3;
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration / 1000);
}

export function playSuccessBeep() {
  playBeep(1200, 100);
}

export function playErrorBeep() {
  playBeep(400, 200);
}

export function useBarcodeScanner({ onScan, minLength = 4, maxGap = 100, enabled = true }: UseBarcodeOptions) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Skip if user is typing in an input field (slow typing)
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

    const now = Date.now();
    const gap = now - lastKeyTimeRef.current;

    if (e.key === 'Enter') {
      if (bufferRef.current.length >= minLength) {
        // This looks like a barcode scan
        const barcode = bufferRef.current;
        bufferRef.current = '';
        setLastScannedCode(barcode);
        onScan(barcode);
        if (isInput) {
          e.preventDefault(); // Prevent form submission from scanner
        }
      }
      bufferRef.current = '';
      return;
    }

    // Single printable character
    if (e.key.length === 1) {
      if (gap > maxGap && bufferRef.current.length > 0) {
        // Gap too large, reset buffer (user is typing, not scanning)
        bufferRef.current = '';
      }
      bufferRef.current += e.key;
      lastKeyTimeRef.current = now;

      // Auto-clear buffer after timeout
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        bufferRef.current = '';
      }, maxGap * 3);
    }
  }, [onScan, minLength, maxGap, enabled]);

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleKeyDown, enabled]);

  return { lastScannedCode };
}
