import { useEffect } from 'react';

type Modifier = 'ctrl' | 'shift' | 'alt' | 'meta';

const normalizeKey = (key: string) => key.toLowerCase();

const parseCombo = (combo: string) => {
  const parts = combo.split('+').map((part) => part.trim().toLowerCase());
  const modifiers: Modifier[] = [];
  let key: string | null = null;

  parts.forEach((part) => {
    if (['cmd', 'meta', 'command'].includes(part)) modifiers.push('meta');
    else if (['ctrl', 'control'].includes(part)) modifiers.push('ctrl');
    else if (['shift'].includes(part)) modifiers.push('shift');
    else if (['alt', 'option'].includes(part)) modifiers.push('alt');
    else key = part;
  });

  return { modifiers, key };
};

interface HotkeyConfig {
  combo: string;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  enabled?: boolean;
}

export const useHotkeys = (hotkeys: HotkeyConfig[], deps: unknown[] = []) => {
  useEffect(() => {
    if (!hotkeys.length) return;

    const onKeyDown = (event: KeyboardEvent) => {
      for (const hotkey of hotkeys) {
        if (hotkey.enabled === false) continue;
        const { modifiers, key } = parseCombo(hotkey.combo);
        const actualKey = normalizeKey(event.key);
        if (key && actualKey !== key) continue;
        if (modifiers.includes('ctrl') !== event.ctrlKey) continue;
        if (modifiers.includes('shift') !== event.shiftKey) continue;
        if (modifiers.includes('alt') !== event.altKey) continue;
        if (modifiers.includes('meta') !== event.metaKey) continue;
        if (!modifiers.includes('ctrl') && event.ctrlKey) continue;
        if (!modifiers.includes('shift') && event.shiftKey && actualKey !== 'shift') continue;
        if (!modifiers.includes('alt') && event.altKey) continue;
        if (!modifiers.includes('meta') && event.metaKey) continue;
        if (hotkey.preventDefault) {
          event.preventDefault();
          event.stopPropagation();
        }
        hotkey.handler(event);
        break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [...deps, hotkeys]);
};
