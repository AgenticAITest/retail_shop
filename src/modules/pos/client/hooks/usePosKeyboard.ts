import { useEffect, useCallback } from 'react';

interface PosKeyboardActions {
  onPayCash?: () => void;
  onPayCard?: () => void;
  onPayQris?: () => void;
  onPayTransfer?: () => void;
  onToggleView?: () => void;
  onTransactionDiscount?: () => void;
  onClearCart?: () => void;
  onDeleteItem?: () => void;
  enabled?: boolean;
}

export function usePosKeyboard({
  onPayCash,
  onPayCard,
  onPayQris,
  onPayTransfer,
  onToggleView,
  onTransactionDiscount,
  onClearCart,
  onDeleteItem,
  enabled = true,
}: PosKeyboardActions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Skip if in an input field
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'F1':
        e.preventDefault();
        onPayCash?.();
        break;
      case 'F2':
        e.preventDefault();
        onPayCard?.();
        break;
      case 'F3':
        e.preventDefault();
        onPayQris?.();
        break;
      case 'F4':
        e.preventDefault();
        onPayTransfer?.();
        break;
      case 'F9':
        e.preventDefault();
        onToggleView?.();
        break;
      case 'F10':
        e.preventDefault();
        onTransactionDiscount?.();
        break;
      case 'Escape':
        e.preventDefault();
        onClearCart?.();
        break;
      case 'Delete':
        e.preventDefault();
        onDeleteItem?.();
        break;
    }
  }, [enabled, onPayCash, onPayCard, onPayQris, onPayTransfer, onToggleView, onTransactionDiscount, onClearCart, onDeleteItem]);

  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}
