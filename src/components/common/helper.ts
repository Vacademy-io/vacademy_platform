import { TokenKey } from "@/constants/auth/tokens";
import { getTokenDecodedData, getTokenFromCookie } from "@/lib/auth/sessionUtility";

export function getInstituteIdSync() {
    const accessToken = getTokenFromCookie(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    console.log("data", data);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    return INSTITUTE_ID;
}
