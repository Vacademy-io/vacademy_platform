import { getAccessToken } from '@/lib/auth/sessionUtility';
import { jwtDecode } from 'jwt-decode';

export async function getUserId(): Promise<string | null> {
  try {
    const token = await getAccessToken();

    if (typeof token !== 'string') {
      return null;
    }

    const decoded: any = jwtDecode(token);
    return decoded?.user ?? null;
  } catch (error) {
    return null;
  }
}
