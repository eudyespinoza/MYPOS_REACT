import { get, post } from './http';
import { deserializeCartSnapshot } from '@/utils/totals';
import type { CartSnapshot } from '@/types/cart';

interface UserInfoResponse {
  email?: string;
  username?: string;
  stores?: string[];
  stores_available?: string[];
  available_stores?: string[];
  last_store?: string;
  lastStore?: string;
  full_name?: string;
}

export const fetchUserInfo = async (): Promise<UserInfoResponse> => {
  return get<UserInfoResponse>('/api/user_info');
};

export const fetchRemoteCart = async (): Promise<CartSnapshot | null> => {
  const raw = await get<unknown>('/api/get_user_cart');
  return deserializeCartSnapshot(raw);
};

export const saveRemoteCart = async (payload: {
  userId: string;
  cart: CartSnapshot;
  timestamp?: string;
}): Promise<void> => {
  await post('/api/save_user_cart', payload);
};

export const updateLastStore = async (storeId: string): Promise<void> => {
  await post('/api/update_last_store', { store_id: storeId });
};
