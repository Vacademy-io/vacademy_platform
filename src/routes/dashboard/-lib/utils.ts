import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import {
  GET_DASHBOARD_DATA,
  GET_NOTIFCATIONS,
  GET_ANNOUNCEMENTS,
  GET_ASSESSMENT_COUNT,
  GET_LAST_7_DAYS_PROGRESS
} from "@/constants/urls";
import { DashbaordResponse, UserActivityArray } from "../-types/dashboard-data-types";
import { getStoredDetails } from "@/routes/assessment/examination/-utils.ts/useFetchAssessment";

export const fetchUserData = async () => {
  const studentData = await Preferences.get({ key: "StudentDetails" });

  const userData = studentData.value ? JSON.parse(studentData.value) : null;
  return userData;
};

export const fetchStaticData = async (
  setUsername: (username: string | null) => void,
  // setAssessmentCount: (count: number) => void,
  setTestAssigned: (count: number) => void,
  setHomeworkAssigned: (count: number) => void,
  setData?: (data: DashbaordResponse) => void,
) => {
  const userData = await fetchUserData();
  const first_name = userData.full_name.split(" ")[0];
  const institute_id = userData.institute_id;
  const batch_id = userData.package_session_id;
  const params = { instituteId: institute_id, packageSessionId: batch_id };
  setUsername(first_name);

  try {
    const url = GET_DASHBOARD_DATA;
    const response = await authenticatedAxiosInstance({
      method: "GET",
      url,
      params,
    });
    if (setData) {
      setData(response.data);
    }
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
  }

  try {
    const url = GET_ASSESSMENT_COUNT;
    const response = await authenticatedAxiosInstance({
      method: "GET",
      url,
      params: { instituteId: institute_id, batchId: batch_id },
    });
    const { test_assigned, homework_assigned } = response.data;
    setTestAssigned(test_assigned);
    setHomeworkAssigned(homework_assigned);
  } catch (error) {
    console.error("Error fetching assessment counts:", error);
  }
};

export const fetchNotifications = async () => {
  try {
    const url = GET_NOTIFCATIONS;
    const response = await authenticatedAxiosInstance({
      method: "GET",
      url: url,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching assessments:", error);
  }
};

export const fetchAnnouncements = async () => {
  try {
    const url = GET_ANNOUNCEMENTS;
    const response = await authenticatedAxiosInstance({
      method: "GET",
      url: url,
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching assessments:", error);
  }
};


  export const fetchLast7DaysProgress = async ({user_id, start_date, end_date}:{
    user_id: string,
    start_date: string,
    end_date: string
  }) : Promise<UserActivityArray> => {
    try{
      const url = GET_LAST_7_DAYS_PROGRESS;
      const {student} = await getStoredDetails();
      const response = await authenticatedAxiosInstance({
        method: 'POST',
        url: url,
        data: {
          user_id: user_id,
          package_session_id: student.package_session_id,
          start_date: start_date,
          end_date: end_date
        }
      })
      return response.data;
    } catch (error) {
      console.error("Error fetching last 7 days progress:", error);
      return [];
    }
  }