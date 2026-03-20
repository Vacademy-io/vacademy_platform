import { getInstituteId } from '@/constants/helper';
import { TokenKey } from '@/constants/auth/tokens';
import { getTokenFromCookie } from '@/lib/auth/sessionUtility';
import { getTokenDecodedData } from '@/lib/auth/sessionUtility';

export function isUserAdmin(): boolean {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const InstituteId = getInstituteId();
    const isAdmin = tokenData?.authorities[InstituteId || '']?.roles.includes('ADMIN');
    return isAdmin || false;
}

export function getUserId(): string {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const userId = tokenData?.user;
    return userId || '';
}

export function getUserName(): string {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const userName = tokenData?.username;
    return userName || '';
}
