import { useCallback, useEffect, useRef, useState } from 'react';

interface UseIdleTimerOptions {
  timeout: number; // ms
  onIdle: () => void;
  enabled?: boolean;
}

export function useIdleTimer({ timeout, onIdle, enabled = true }: UseIdleTimerOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isIdle, setIsIdle] = useState(false);

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsIdle(false);
    timerRef.current = setTimeout(() => {
      setIsIdle(true);
      onIdle();
    }, timeout);
  }, [timeout, onIdle, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const events = ['mousemove', 'keydown', 'touchstart', 'mousedown', 'scroll'];
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => document.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, enabled]);

  return { isIdle, resetTimer };
}
