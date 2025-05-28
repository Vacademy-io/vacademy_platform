import { Preferences } from "@capacitor/preferences";

export const getUserId = async () => {
    const USER_ID_KEY = 'StudentDetails';
    const userDetailsStr = await Preferences.get({ key: USER_ID_KEY });
    const userDetails = userDetailsStr.value ? JSON.parse(userDetailsStr.value) : null;
    const userId = userDetails?.user_id || null;
    return userId;
}