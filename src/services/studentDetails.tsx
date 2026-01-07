import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { STUDENT_DETAIL } from "@/constants/urls";
import { Batch, Institute, Student } from "@/types/user/user-detail";

// 🔧 Type Definitions
interface FallbackUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  roles: string[];
}

// 🔍 API call to fetch student details
export const fetchStudentDetails = async (
  instituteId: string,
  userId: string
) => {
  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: STUDENT_DETAIL,
    params: { instituteId, userId },
  });

  return response;
};

// ⚙️ React Query config
export const getStudentDetails = (instituteId?: string, userId?: string) => {
  return {
    queryKey: ["STUDENT_DETAILS", instituteId, userId],
    queryFn: async () => {
      if (!instituteId || !userId) {
        console.warn("⚠️ Institute ID or User ID missing");
        throw new Error("Institute ID and User ID are required");
      }

      const data = await fetchStudentDetails(instituteId, userId);
      return data;
    },
    staleTime: 1000,
    refetchInterval: 1000,
  };
};

// 🛠️ Helper: Create fallback student object
const createFallbackStudent = (
  userId: string,
  instituteId: string,
  fallbackUser: FallbackUser
): Student => {
  return {
    id: userId,
    user_id: userId,
    username: fallbackUser.username,
    email: fallbackUser.email,
    full_name: fallbackUser.full_name,
    institute_id: instituteId,
    package_session_id: "",
    status: "ACTIVE",
    address_line: "",
    region: "",
    city: "",
    pin_code: "",
    mobile_number: "",
    date_of_birth: "",
    gender: "",
    linked_institute_name: "",
    institute_enrollment_id: "",
    session_expiry_days: "",
    face_file_id: "",
    expiry_date: "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    country: "",
    mother_name: "",
    father_name: "",
    parents_mobile_number: "",
    parents_email: "",
  } as Student;
};

// 🛠️ Helper: Sync data to localStorage (best effort)
const syncToLocalStorage = (key: string, data: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn(`Failed to sync ${key} to localStorage:`, error);
    // TODO: Implement retry mechanism or quota management
  }
};

// 🛠️ Helper: Store fallback student data
const storeFallbackStudent = async (
  userId: string,
  instituteId: string,
  fallbackUser: FallbackUser
): Promise<void> => {
  console.warn("⚠️ Using fallback student data for user:", userId);

  const fallbackStudent = createFallbackStudent(userId, instituteId, fallbackUser);

  // Store in Capacitor Preferences
  await Preferences.set({
    key: "students",
    value: JSON.stringify([fallbackStudent]),
  });

  await Preferences.set({
    key: "StudentDetails",
    value: JSON.stringify(fallbackStudent),
  });

  // Store empty session list to prevent undefined errors downstream
  await Preferences.set({
    key: "sessionList",
    value: JSON.stringify([]),
  });

  // Sync to localStorage for faster synchronous access
  syncToLocalStorage("students", [fallbackStudent]);
  syncToLocalStorage("StudentDetails", fallbackStudent);
  syncToLocalStorage("sessionList", []);

  console.log("✅ Fallback student data stored successfully");
};

// 🛠️ Helper: Store student data in all storage locations
const storeStudentData = async (
  students: Student[],
  instituteId: string
): Promise<void> => {
  // Store students array
  await Preferences.set({
    key: "students",
    value: JSON.stringify(students),
  });
  syncToLocalStorage("students", students);

  // Store primary student details
  if (students.length > 0) {
    const studentData = {
      ...students[0],
      institute_id: instituteId,
    };

    await Preferences.set({
      key: "StudentDetails",
      value: JSON.stringify(studentData),
    });
    syncToLocalStorage("StudentDetails", studentData);
  }
};

// 🛠️ Helper: Store session mappings
const storeSessionMappings = async (
  students: Student[],
  institute: Institute
): Promise<void> => {
  if (!institute.batches_for_sessions || institute.batches_for_sessions.length === 0) {
    console.warn("⚠️ No batches found in institute details, skipping session mapping");
    return;
  }

  const packageSessionIds = students.map((s) => s.package_session_id);
  const matchedSessions = institute.batches_for_sessions.filter(
    (batch: Batch) => packageSessionIds.includes(batch.id)
  );

  // Store matched sessions
  await Preferences.set({
    key: "sessionList",
    value: JSON.stringify(matchedSessions),
  });

  // Store institute batches as fallback
  await Preferences.set({
    key: "instituteBatchesForSessions",
    value: JSON.stringify(institute.batches_for_sessions),
  });

  await storeMappedSessions();
};

// 🔐 Fetch and store student details + sessions
export const fetchAndStoreStudentDetails = async (
  instituteId: string,
  userId: string,
  fallbackUser?: FallbackUser
) => {
  try {
    const { queryFn } = getStudentDetails(instituteId, userId);
    let response;
    let shouldUseFallback = false;

    // Attempt API call
    try {
      response = await queryFn();
    } catch (apiError) {
      console.error("❌ API call failed:", apiError);
      if (!fallbackUser) {
        throw apiError; // No fallback available, propagate error
      }
      shouldUseFallback = true;
    }

    // Handle API call failure with fallback
    if (shouldUseFallback && fallbackUser) {
      await storeFallbackStudent(userId, instituteId, fallbackUser);
      return 201;
    }

    // Ensure response is defined before proceeding
    if (!response) {
      console.error("❌ No response received from student details API");
      return 500;
    }

    // Handle successful response with empty data (race condition for new users)
    if (response.status === 200) {
      const students: Student[] = response.data;

      if (students.length === 0 && fallbackUser) {
        console.warn("⚠️ API returned empty list, using fallback for new user");
        await storeFallbackStudent(userId, instituteId, fallbackUser);
        return 201;
      }

      // Store student data
      await storeStudentData(students, instituteId);

      // Get institute data for session mapping
      const instituteData = await Preferences.get({
        key: "InstituteDetails",
      });

      if (!instituteData.value) {
        console.warn("⚠️ No institute data found, skipping session mapping");
        return response.status;
      }

      const institute: Institute = JSON.parse(instituteData.value);
      await storeSessionMappings(students, institute);

      return response.status;
    }

    // Handle 201 status (single student response)
    if (response.status === 201) {
      const student: Student = response.data[0];
      const studentData = {
        ...student,
        institute_id: instituteId,
      };

      await Preferences.set({
        key: "StudentDetails",
        value: JSON.stringify(studentData),
      });

      await Preferences.set({
        key: "students",
        value: JSON.stringify([studentData]),
      });

      syncToLocalStorage("StudentDetails", studentData);
      syncToLocalStorage("students", [studentData]);

      return response.status;
    }

    // Handle other status codes with fallback
    if (fallbackUser) {
      console.warn(`⚠️ Unexpected status ${response.status}, using fallback`);
      await storeFallbackStudent(userId, instituteId, fallbackUser);
      return 201;
    }

    return response.status;
  } catch (error) {
    console.error("❌ Failed to fetch and store student details:", error);
    throw error;
  }
};

// 🗂️ Store mapped sessions
const storeMappedSessions = async () => {
  try {
    const studentData = await Preferences.get({ key: "students" });
    const students: Student[] = studentData.value
      ? JSON.parse(studentData.value)
      : [];

    const instituteData = await Preferences.get({
      key: "InstituteDetails",
    });

    if (!instituteData.value) {
      console.warn("⚠️ No institute data found for session mapping");
      return;
    }

    const institute: Institute = JSON.parse(instituteData.value);
    const sessionIds = students.map((s) => s.package_session_id);

    const matchedSessions =
      institute.batches_for_sessions?.filter((batch: Batch) =>
        sessionIds.includes(batch.id)
      ) || [];

    await Preferences.set({
      key: "sessionList",
      value: JSON.stringify(matchedSessions),
    });
  } catch (error) {
    console.error("❌ Error in storeMappedSessions:", error);
  }
};

// 🧠 Get stored students
export const getStoredStudentDetails = async (): Promise<Student[] | null> => {
  try {
    const { value } = await Preferences.get({ key: "students" });
    return value ? (JSON.parse(value) as Student[]) : null;
  } catch (error) {
    console.error("❌ Error parsing stored student details:", error);
    return null;
  }
};

// 📚 Get matched sessions from Preferences
export const getMappedSessions = async (): Promise<Batch[] | null> => {
  try {
    let studentData = await Preferences.get({ key: "students" });

    if (!studentData.value) {
      studentData = await Preferences.get({ key: "StudentDetails" });

      if (!studentData.value) {
        return null;
      }
    }

    const student: Student = JSON.parse(studentData.value);

    const instituteData = await Preferences.get({
      key: "InstituteDetails",
    });

    if (!instituteData.value) {
      return null;
    }

    const institute: Institute = JSON.parse(instituteData.value);

    if (
      !institute.batches_for_sessions ||
      institute.batches_for_sessions.length === 0
    ) {
      return null;
    }

    const matchedSessions = institute.batches_for_sessions.filter(
      (batch: Batch) => batch.id === student.package_session_id
    );

    if (matchedSessions.length === 0) {
      return null;
    }

    return matchedSessions;
  } catch (error) {
    console.error("❌ Error mapping sessions:", error);
    return null;
  }
};

// 📋 Get all sessions from storage
export const getAllSessionListFromStorage = async (): Promise<
  Batch[] | null
> => {
  try {
    const sessionData = await Preferences.get({ key: "sessionList" });

    if (!sessionData.value) {
      return null;
    }

    const sessions: Batch[] = JSON.parse(sessionData.value);
    return sessions;
  } catch (error) {
    console.error("❌ Error retrieving session list from storage:", error);
    return null;
  }
};