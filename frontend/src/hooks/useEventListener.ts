import { useEffect, useRef } from 'react';

type Target = Window | Document | HTMLElement | null;

type EventMap<T extends Target> = T extends Window
  ? WindowEventMap
  : T extends Document
  ? DocumentEventMap
  : T extends HTMLElement
  ? HTMLElementEventMap
  : Record<string, Event>;

export const useEventListener = <
  T extends Target,
  K extends keyof EventMap<T>,
>(target: T, type: K, listener: (event: EventMap<T>[K]) => void, options?: boolean | AddEventListenerOptions) => {
  const savedHandler = useRef(listener);

  useEffect(() => {
    savedHandler.current = listener;
  }, [listener]);

  useEffect(() => {
    const element = target ?? window;
    if (!element?.addEventListener) return;

    const handler = (event: Event) => savedHandler.current?.(event as EventMap<T>[K]);
    element.addEventListener(type as string, handler, options);
    return () => element.removeEventListener(type as string, handler, options);
  }, [target, type, options]);
};
