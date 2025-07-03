import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { STUDENT_DETAIL } from "@/constants/urls";
import { Batch, Institute, Student } from "@/types/user/user-detail";

// Fetch student details from API
export const fetchStudentDetails = async (instituteId: string, userId: string) => {
  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: STUDENT_DETAIL,
    params: { instituteId, userId },
  });
  return response;
};

// React Query config
export const getStudentDetails = (instituteId?: string, userId?: string) => {
  return {
    queryKey: ["STUDENT_DETAILS", instituteId, userId],
    queryFn: async () => {
      if (!instituteId || !userId) {
        throw new Error("Institute ID and User ID are required");
      }
      const data = await fetchStudentDetails(instituteId, userId);
      return data;
    },
    staleTime: 1000,
    refetchInterval: 1000,
  };
};

// Fetch and store student details + mapped sessions
export const fetchAndStoreStudentDetails = async (
  instituteId: string,
  userId: string
) => {
  try {
    const { queryFn } = getStudentDetails(instituteId, userId);
    const response = await queryFn();

    if (response.status === 200) {
      const students: Student[] = response.data;

      await Preferences.set({
        key: "students",
        value: JSON.stringify(students),
      });

      // ✅ Always store first student for session check
      if (students.length > 0) {
        await Preferences.set({
          key: "StudentDetails",
          value: JSON.stringify(students[0]),
        });
      }

      const instituteData = await Preferences.get({ key: "InstituteDetails" });
      if (!instituteData.value) throw new Error("No institute data found!");

      const institute: Institute = JSON.parse(instituteData.value);
      if (!institute.batches_for_sessions)
        throw new Error("No batches found in institute details!");

      const packageSessionIds = students.map((student) => student.package_session_id);
      const matchedSessions = institute.batches_for_sessions.filter((batch: Batch) =>
        packageSessionIds.includes(batch.id)
      );

      await Preferences.set({
        key: "sessionList",
        value: JSON.stringify(matchedSessions),
      });

      await storeMappedSessions();
    } else if (response.status === 201) {
      const student: Student = response.data[0];

      // Store in both places for consistency
      await Preferences.set({
        key: "StudentDetails",
        value: JSON.stringify(student),
      });
      await Preferences.set({
        key: "students",
        value: JSON.stringify([student]),
      });
    }

    // ✅ Debug logs
    console.log("✅ Stored StudentDetails:", await Preferences.get({ key: "StudentDetails" }));
    console.log("✅ Stored students:", await Preferences.get({ key: "students" }));

    return response.status;
  } catch (error) {
    console.error("Failed to fetch and store student details:", error);
    throw error;
  }
};

// ✅ Store mapped sessions from Preferences
const storeMappedSessions = async () => {
  try {
    const studentData = await Preferences.get({ key: "students" });
    const students: Student[] = studentData.value
      ? JSON.parse(studentData.value)
      : [];

    const instituteData = await Preferences.get({ key: "InstituteDetails" });
    if (!instituteData.value) throw new Error("No institute data found!");

    const institute: Institute = JSON.parse(instituteData.value);
    const sessionIds = students.map((s: Student) => s.package_session_id);

    const matchedSessions = institute.batches_for_sessions?.filter((batch: Batch) =>
      sessionIds.includes(batch.id)
    ) || [];

    await Preferences.set({
      key: "sessionList",
      value: JSON.stringify(matchedSessions),
    });
  } catch (error) {
    console.error("Error in storing mapped sessions:", error);
  }
};

// ✅ Get stored student array
export const getStoredStudentDetails = async (): Promise<Student[] | null> => {
  try {
    const { value } = await Preferences.get({ key: "students" });
    return value ? (JSON.parse(value) as Student[]) : null;
  } catch (error) {
    console.error("Error parsing stored student details:", error);
    return null;
  }
};

// ✅ Get sessions mapped to student package_session_id
export const getMappedSessions = async (): Promise<Batch[] | null> => {
  try {
    let studentData = await Preferences.get({ key: "students" });

    if (!studentData.value) {
      studentData = await Preferences.get({ key: "StudentDetails" });
      if (!studentData.value) {
        console.warn("No student data found! Returning null.");
        return null;
      }
    }

    const student: Student = JSON.parse(studentData.value);

    const instituteData = await Preferences.get({ key: "InstituteDetails" });
    if (!instituteData.value) {
      console.warn("No institute data found! Returning null.");
      return null;
    }

    const institute: Institute = JSON.parse(instituteData.value);

    if (!institute.batches_for_sessions || institute.batches_for_sessions.length === 0) {
      console.warn("No batches found in institute details! Returning null.");
      return null;
    }

    const matchedSessions = institute.batches_for_sessions.filter(
      (batch: Batch) => batch.id === student.package_session_id
    );

    if (matchedSessions.length === 0) {
      console.warn("No matching sessions found!");
      return null;
    }

    return matchedSessions;
  } catch (error) {
    console.error("Error mapping sessions:", error);
    return null;
  }
};
