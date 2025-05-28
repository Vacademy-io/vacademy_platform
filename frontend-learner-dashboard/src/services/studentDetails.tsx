import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { STUDENT_DETAIL } from "@/constants/urls";
import { Batch, Institute, Student } from "@/types/user/user-detail";
// import { useQuery } from "@tanstack/react-query";

// export const useStudentDetails = (instituteId: string, userId: string) => {
//   console.log("Fetching student details for:", { instituteId, userId });
//   return useQuery({
//     queryKey: ["studentDetails", instituteId, userId],
//     queryFn: () => fetchStudentDetails(instituteId, userId),
//     staleTime: 1000 , // 5 minutes stale time
//     cacheTime: 1000 , // Keep in cache for 10 minutes
//     refetchInterval: 1000, // Auto-refetch every 1 minute
//     refetchOnWindowFocus: false, // Don't refetch when user switches back to app
//   });
// };

export const fetchStudentDetails = async (instituteId: string, userId: string) => {
  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: STUDENT_DETAIL,
    params: { instituteId, userId },
  });
  return response;
};

// export const getStudentDetails = (instituteId: string | undefined, userId: string | undefined) => {
//   return {
//       queryKey: ["STUDENT_DETAILS", instituteId, userId],
//       queryFn: async () => {
//           if (!instituteId || !userId) {
//               throw new Error("Institute ID and User ID are required");
//           }
//           const data = await fetchStudentDetails(instituteId, userId);
//           return data;
//       },
//       staleTime: 1000,
//   };
// };

export const getStudentDetails = (instituteId: string | undefined, userId: string | undefined) => {
  return {
    queryKey: ["STUDENT_DETAILS", instituteId, userId],
    queryFn: async () => {
      if (!instituteId || !userId) {
        throw new Error("Institute ID and User ID are required");
      }
      const data = await fetchStudentDetails(instituteId, userId);
      return data;
    },
    staleTime: 1000, // 1 second for testing, adjust accordingly
    refetchInterval: 1000, // Automatically refetch after every second (same as staleTime, adjust as needed)
  };
};

export const fetchAndStoreStudentDetails = async (
  instituteId: string,
  userId: string
) => {
  try {
     // Use getStudentDetails instead of fetchStudentDetails
     const { queryFn } = getStudentDetails(instituteId, userId);

     // Call the queryFn to fetch the data
     const response = await queryFn();

    if (response.status === 200) {
      const students: Student[] = response.data;

      await Preferences.set({
        key: "students",
        value: JSON.stringify(students),
      });

      const instituteData = await Preferences.get({ key: "InstituteDetails" });
      if (!instituteData.value) throw new Error("No institute data found!");

      const institute: Institute = JSON.parse(instituteData.value);

      if (!institute.batches_for_sessions)
        throw new Error("No batches found in institute details!");

      const packageSessionIds = students.map(
        (student) => student.package_session_id
      );
      console.log("Extracted package_session_id list:", packageSessionIds);

      const matchedSessions = institute.batches_for_sessions.filter(
        (batch: Batch) => packageSessionIds.includes(batch.id)
      );

      console.log("Mapped Sessions:", matchedSessions);

      await Preferences.set({
        key: "sessionList",
        value: JSON.stringify(matchedSessions),
      });

    } else if (response.status === 201) {
      const student: Student = response.data[0];

      await Preferences.set({
        key: "StudentDetails",
        value: JSON.stringify(student),
      });
    }
    return response.status;
  } catch (error) {
    console.error("Failed to fetch and store student details:", error);
    throw error;
  }
};

const storeMappedSessions = async () => {
  try {
    // Get Student Details
    const studentData = await Preferences.get({ key: "students" });
    // if (!studentData.value) throw new Error("No student data found!");

    const students: Student[] = studentData.value
      ? JSON.parse(studentData.value)
      : [];
    console.log("Student Details:", students);

    // Get Institute Details
    const instituteData = await Preferences.get({ key: "InstituteDetails" });
    if (!instituteData.value) throw new Error("No institute data found!");

    const institute: Institute = JSON.parse(instituteData.value);
    console.log("Institute Details:", institute);

    // Extract package_session_id from students
    const sessionIds = students.map((s: Student) => s.package_session_id);
    console.log("Extracted package_session_id list:", sessionIds);

    // Filter batches that match package_session_id
    institute.batches_for_sessions.filter(
      (batch: Batch) => sessionIds.includes(batch.id)
    );

  } catch (error) {
    console.error("Error in storing mapped sessions:", error);
  }
};

// Call this function where needed (e.g., after fetching student & institute data)
storeMappedSessions();

export const getStoredStudentDetails = async (): Promise<Student[] | null> => {
  try {
    console.log("Retrieving stored student details...");
    const { value } = await Preferences.get({ key: "students" });
    console.log("Stored student details retrieved:", value);
    return value ? (JSON.parse(value) as Student[]) : null;
  } catch (error) {
    console.error("Error parsing stored student details:", error);
    return null;
  }
};

export const getMappedSessions = async (): Promise<Batch[] | null> => {
  try {
    // Try fetching multiple students first
    let studentData = await Preferences.get({ key: "students" });

    if (!studentData.value) {
      // If no multiple students found, check for single student case
      studentData = await Preferences.get({ key: "StudentDetails" });
      if (!studentData.value) {
        console.warn("No student data found! Returning null.");
        return null; // Instead of throwing an error
      }
    }

    const student: Student = JSON.parse(studentData.value);

    // Fetch stored institute details
    const instituteData = await Preferences.get({ key: "InstituteDetails" });
    if (!instituteData.value) {
      console.warn("No institute data found! Returning null.");
      return null;
    }

    const institute: Institute = JSON.parse(instituteData.value);

    // Ensure batches_for_sessions exist
    if (
      !institute.batches_for_sessions ||
      institute.batches_for_sessions.length === 0
    ) {
      console.warn("No batches found in institute details! Returning null.");
      return null;
    }

    // Filter student package_session_id with institute batches_for_sessions
    const matchedSessions = institute.batches_for_sessions.filter(
      (batch: Batch) => batch.id === student.package_session_id
    );

    if (matchedSessions.length === 0) {
      console.warn("No matching sessions found!");
      return null;
    }

    console.log("Mapped Sessions:", matchedSessions);
    return matchedSessions;
  } catch (error) {
    console.error("Error mapping sessions:", error);
    return null;
  }
};
