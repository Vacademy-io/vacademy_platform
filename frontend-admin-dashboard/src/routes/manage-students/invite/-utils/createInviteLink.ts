import { TokenKey } from '@/constants/auth/tokens';
import { getTokenDecodedData, getTokenFromCookie } from '@/lib/auth/sessionUtility';

export default function createInviteLink(inviteCode: string) {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const tokenData = getTokenDecodedData(accessToken);
    const INSTITUTE_ID = tokenData && Object.keys(tokenData.authorities)[0];
    const url = `https://frontend-learner-dashboard-app.pages.dev/learner-invitation-response?instituteId=${INSTITUTE_ID}&inviteCode=${inviteCode}`;
    return url;
}
