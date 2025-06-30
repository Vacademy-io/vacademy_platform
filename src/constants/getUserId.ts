import { getAccessToken } from '@/lib/auth/sessionUtility';
import { jwtDecode } from 'jwt-decode';

export async function getUserId(): Promise<string | null> {
  try {
    const token = await getAccessToken();

    if (typeof token !== 'string') {
      console.warn('[getUserId] Token is not a string:', token);
      return null;
    }

    const decoded: any = jwtDecode(token);
    return decoded?.user ?? null;
  } catch (error) {
    console.error('[getUserId] Failed to decode token:', error);
    return null;
  }
}
