import { TokenKey } from "@/constants/auth/tokens";
import { getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { getTokenFromStorage } from "@/lib/auth/axiosInstance";

export async function getInstituteIdSync() {
    const accessToken = await getTokenFromStorage(TokenKey.accessToken);
    const data = getTokenDecodedData(accessToken);
    console.log("data", data);
    const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
    return INSTITUTE_ID;
}
