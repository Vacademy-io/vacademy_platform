import { Preferences } from "@capacitor/preferences";

export const getPackageSessionId = async () => {
    const USER_ID_KEY = 'StudentDetails';
    const userDetailsStr = await Preferences.get({ key: USER_ID_KEY });
    const userDetails = userDetailsStr.value ? JSON.parse(userDetailsStr.value) : null;
    const package_session_id = userDetails?.package_session_id || null;
    return package_session_id;
};

// Get all batch IDs for users enrolled in multiple batches
export const getAllPackageSessionIds = async (): Promise<string[]> => {
    try {
        // First try to get from students array (which contains all enrollments)
        const studentsStr = await Preferences.get({ key: 'students' });
        if (studentsStr.value) {
            const students = JSON.parse(studentsStr.value);
            if (Array.isArray(students) && students.length > 0) {
                const batchIds = students
                    .map((s: any) => s.package_session_id)
                    .filter((id: string) => id && id.trim() !== '');
                return batchIds;
            }
        }

        // Fallback: try sessionList
        const sessionListStr = await Preferences.get({ key: 'sessionList' });
        if (sessionListStr.value) {
            const sessions = JSON.parse(sessionListStr.value);
            if (Array.isArray(sessions) && sessions.length > 0) {
                const batchIds = sessions
                    .map((s: any) => s.id)
                    .filter((id: string) => id && id.trim() !== '');
                return batchIds;
            }
        }

        // Final fallback: single StudentDetails
        const userDetailsStr = await Preferences.get({ key: 'StudentDetails' });
        if (userDetailsStr.value) {
            const userDetails = JSON.parse(userDetailsStr.value);
            const package_session_id = userDetails?.package_session_id;
            if (package_session_id && package_session_id.trim() !== '') {
                return [package_session_id];
            }
        }

        return [];
    } catch (error) {
        console.error('Error getting all package session IDs:', error);
        return [];
    }
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