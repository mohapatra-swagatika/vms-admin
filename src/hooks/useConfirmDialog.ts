'use client';
import { useCallback, useRef, useState } from 'react';
import type { ConfirmDialogProps } from '@/components/ConfirmDialog';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export function useConfirmDialog() {
  const resolveRef = useRef<((value: boolean) => void) | null>(null);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
      setOptions(opts);
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const dialogProps: ConfirmDialogProps = {
    open: options !== null,
    title: options?.title ?? '',
    message: options?.message ?? '',
    confirmLabel: options?.confirmLabel,
    cancelLabel: options?.cancelLabel,
    destructive: options?.destructive ?? true,
    onConfirm: () => close(true),
    onCancel: () => close(false),
  };

  return { confirm, dialogProps };
}
