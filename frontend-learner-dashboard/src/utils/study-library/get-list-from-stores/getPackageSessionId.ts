import { Preferences } from "@capacitor/preferences";

export const getPackageSessionId = async () => {
    const USER_ID_KEY = 'StudentDetails';
    const userDetailsStr = await Preferences.get({ key: USER_ID_KEY });
    const userDetails = userDetailsStr.value ? JSON.parse(userDetailsStr.value) : null;
    const package_session_id = userDetails?.package_session_id || null;
    return package_session_id;
};

export const getUserId = async () => {
    const USER_ID_KEY = 'StudentDetails';
    const userDetailsStr = await Preferences.get({ key: USER_ID_KEY });
    const userDetails = userDetailsStr.value ? JSON.parse(userDetailsStr.value) : null;
    const user_id = userDetails?.user_id || null;
    return user_id;
};

export const getInstituteId = async () => {
    const INSTITUTE_ID_KEY = 'InstituteDetails';
    const instituteDetailsStr = await Preferences.get({ key: INSTITUTE_ID_KEY });
    const instituteDetails = instituteDetailsStr.value ? JSON.parse(instituteDetailsStr.value) : null;
    const institute_id = instituteDetails?.id || null;
    return institute_id;
};