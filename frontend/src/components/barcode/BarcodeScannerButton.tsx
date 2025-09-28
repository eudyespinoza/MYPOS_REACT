import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';

interface Props {
  onDetect: (code: string) => void;
}

type DetectorState = 'idle' | 'starting' | 'scanning' | 'unsupported';

const stopStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop());
};

export const BarcodeScannerButton = ({ onDetect }: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const [state, setState] = useState<DetectorState>('idle');
  const [error, setError] = useState<string | null>(null);

  const supported = useMemo(() => typeof window !== 'undefined' && 'BarcodeDetector' in window, []);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState(supported ? 'idle' : 'unsupported');
  }, [supported]);

  const detectLoop = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) return;
    try {
      const results = await detectorRef.current.detect(videoRef.current);
      if (Array.isArray(results) && results.length > 0) {
        const code = results[0]?.rawValue ?? '';
        if (code) {
          onDetect(code);
          stop();
          return;
        }
      }
    } catch (err) {
      console.warn('Barcode detection failed', err);
    }
    rafRef.current = requestAnimationFrame(detectLoop);
  }, [onDetect, stop]);

  const start = useCallback(async () => {
    if (!supported) {
      setState('unsupported');
      return;
    }
    try {
      setError(null);
      setState('starting');
      if (!detectorRef.current) {
        detectorRef.current = new BarcodeDetector();
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('scanning');
      rafRef.current = requestAnimationFrame(detectLoop);
    } catch (err) {
      console.warn('Unable to start barcode scanner', err);
      setError('No se pudo acceder a la cámara');
      stop();
    }
  }, [detectLoop, stop, supported]);

  useEffect(() => {
    if (!supported) {
      setState('unsupported');
      return () => undefined;
    }
    return () => stop();
  }, [stop, supported]);

  if (!supported) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        className={clsx(
          'flex h-10 items-center gap-1 rounded-lg border border-slate-700 px-3 text-xs text-slate-200 transition hover:border-primary-400 hover:text-primary-200',
          state === 'scanning' && 'border-primary-400 text-primary-200',
        )}
        onClick={() => {
          if (state === 'scanning') {
            stop();
          } else {
            void start();
          }
        }}
        aria-pressed={state === 'scanning'}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2m12-4v2a1 1 0 01-1 1h-2m3-12V5a1 1 0 00-1-1h-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M6 9h1v6H6zm3 0h1v6H9zm3 0h2v6h-2zm4 0h1v6h-1zm2 0h1v6h-1z" fill="currentColor" />
        </svg>
        <span>{state === 'scanning' ? 'Escaneando…' : 'Escanear'}</span>
      </button>

      {state === 'scanning' ? (
        <div className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-slate-800 bg-slate-950 p-3 shadow-lg">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>Escaneando código…</span>
            <button type="button" className="text-primary-300 hover:underline" onClick={stop}>
              Detener
            </button>
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-800">
            <video ref={videoRef} className="h-36 w-full bg-black object-cover" muted playsInline />
          </div>
          {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
};
