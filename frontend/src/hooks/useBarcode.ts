import { useEffect, useRef } from 'react';

interface Options {
  enabled?: boolean;
  minLength?: number;
  timeoutMs?: number;
  onScan: (code: string) => void;
}

export const useBarcode = ({ enabled = true, minLength = 4, timeoutMs = 80, onScan }: Options) => {
  const bufferRef = useRef('');
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return;

    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput = target && ['input', 'textarea'].includes(target.tagName.toLowerCase());
      if (isInput && !event.ctrlKey && !event.altKey && !event.metaKey) {
        return;
      }

      if (event.key === 'Enter') {
        if (bufferRef.current.length >= minLength) {
          onScan(bufferRef.current);
        }
        bufferRef.current = '';
        window.clearTimeout(timerRef.current);
        return;
      }

      if (event.key.length === 1) {
        bufferRef.current += event.key;
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          if (bufferRef.current.length >= minLength) {
            onScan(bufferRef.current);
          }
          bufferRef.current = '';
        }, timeoutMs);
      } else {
        bufferRef.current = '';
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      bufferRef.current = '';
    };
  }, [enabled, minLength, timeoutMs, onScan]);
};
