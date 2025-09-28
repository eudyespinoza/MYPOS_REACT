import { useCallback, useEffect } from 'react';
import { saveRemoteCart } from '@/api/cart';
import { useCartStore } from '@/stores/useCartStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useOnlineStatus } from './useOnlineStatus';
import { useDebouncedValue } from './useDebouncedValue';

export const useCartRemoteSync = () => {
  const cart = useCartStore((state) => state.cart);
  const needsSync = useCartStore((state) => state.needsSync);
  const isSyncing = useCartStore((state) => state.isSyncing);
  const setSyncing = useCartStore((state) => state.setSyncing);
  const markSynced = useCartStore((state) => state.markSynced);
  const setRemoteError = useCartStore((state) => state.setRemoteError);
  const userEmail = useSessionStore((state) => state.userEmail);
  const isOnline = useOnlineStatus();

  const debouncedCart = useDebouncedValue({ cart, needsSync }, 400);

  const sync = useCallback(async () => {
    if (!userEmail || !isOnline) return;
    try {
      setSyncing(true);
      await saveRemoteCart({ userId: userEmail, cart, timestamp: new Date().toISOString() });
      markSynced();
      setRemoteError(null);
    } catch (error) {
      console.warn('Error al sincronizar carrito remoto', error);
      setRemoteError(error instanceof Error ? error.message : 'Error desconocido');
    } finally {
      setSyncing(false);
    }
  }, [userEmail, isOnline, cart, setSyncing, markSynced, setRemoteError]);

  useEffect(() => {
    if (!debouncedCart.needsSync || isSyncing || !userEmail || !isOnline) return;
    void sync();
  }, [debouncedCart, isSyncing, userEmail, isOnline, sync]);

  return { syncNow: sync, isOnline };
};
