import { useEffect, useMemo, useRef } from 'react';
import { Modal } from './Modal';

interface EnvelopeMessage {
  type: string;
  [key: string]: unknown;
}

interface Props {
  open: boolean;
  total: number;
  currency?: string;
  onClose: () => void;
  onApply?: (payload: unknown) => void;
}

declare global {
  interface Window {
    SIMULATOR_V5_URL?: string;
  }
}

const formatCurrencyParam = (value: number) => value.toFixed(2);

export const PaymentSimulatorModal = ({ open, total, currency = 'ARS', onClose, onApply }: Props) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const simulatorUrl = useMemo(() => window.SIMULATOR_V5_URL ?? '', []);

  useEffect(() => {
    if (!open || !iframeRef.current || !simulatorUrl) return;
    const iframe = iframeRef.current;
    const payload = {
      type: 'simulator:set-total',
      total,
      currency,
    };
    const sendMessage = () => {
      try {
        iframe.contentWindow?.postMessage(payload, '*');
      } catch (error) {
        console.warn('No se pudo comunicar con el simulador', error);
      }
    };

    const id = window.setTimeout(sendMessage, 400);
    return () => window.clearTimeout(id);
  }, [open, total, currency, simulatorUrl]);

  useEffect(() => {
    const handler = (event: MessageEvent<EnvelopeMessage>) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'simulator:payment-selection') {
        onApply?.(event.data);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onApply]);

  const iframeSrc = useMemo(() => {
    if (!simulatorUrl) return '';
    const url = new URL(simulatorUrl, window.location.origin);
    url.searchParams.set('total', formatCurrencyParam(total));
    url.searchParams.set('currency', currency);
    url.searchParams.set('ts', Date.now().toString());
    return url.toString();
  }, [simulatorUrl, total, currency]);

  return (
    <Modal open={open} onClose={onClose} title="Simulador de pagos" size="xl">
      {simulatorUrl ? (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Simulador de pagos"
          className="h-[32rem] w-full rounded-xl border border-slate-800 bg-slate-900"
          allow="payment"
        />
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-300">
          No se configuró la URL del simulador (window.SIMULATOR_V5_URL).
        </div>
      )}
    </Modal>
  );
};
