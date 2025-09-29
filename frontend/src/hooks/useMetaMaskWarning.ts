import { useEffect, useRef } from 'react';
import { useToastStore } from '@/stores/useToastStore';

const METAMASK_KEYWORDS = ['metamask extension not found', 'failed to connect to metamask'];

const collectMessages = (reason: unknown): string[] => {
  const messages: string[] = [];

  const visit = (value: unknown): void => {
    if (!value) return;
    if (typeof value === 'string') {
      messages.push(value);
      return;
    }
    if (value instanceof Error) {
      if (value.message) {
        messages.push(value.message);
      }
      if (value.cause) {
        visit(value.cause);
      }
      return;
    }
    if (typeof value === 'object') {
      const message = (value as { message?: unknown }).message;
      if (typeof message === 'string') {
        messages.push(message);
      }
      const cause = (value as { cause?: unknown }).cause;
      if (cause) {
        visit(cause);
      }
    }
  };

  visit(reason);
  return messages;
};

const isMetaMaskMissingError = (reason: unknown): boolean => {
  const messages = collectMessages(reason).map((message) => message.toLowerCase());
  if (!messages.length) return false;

  return messages.some((message) =>
    METAMASK_KEYWORDS.some((keyword) => message.includes(keyword)),
  );
};

export const useMetaMaskWarning = () => {
  const pushToast = useToastStore((state) => state.pushToast);
  const hasWarnedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const notifyOnce = () => {
      if (hasWarnedRef.current) return;
      hasWarnedRef.current = true;
      pushToast({
        id: 'metamask-missing',
        tone: 'warning',
        title: 'MetaMask no está disponible',
        description:
          'Instala la extensión MetaMask o utiliza un navegador compatible para continuar con las operaciones que requieren billetera.',
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (!isMetaMaskMissingError(event.reason)) return;
      event.preventDefault();
      notifyOnce();
    };

    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [pushToast]);
};
