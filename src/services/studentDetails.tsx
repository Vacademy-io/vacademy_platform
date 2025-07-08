import { Preferences } from "@capacitor/preferences";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { STUDENT_DETAIL } from "@/constants/urls";
import { Batch, Institute, Student } from "@/types/user/user-detail";

// 🔍 API call to fetch student details
export const fetchStudentDetails = async (instituteId: string, userId: string) => {
  console.log("📡 Calling fetchStudentDetails with:", { instituteId, userId });

  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: STUDENT_DETAIL,
    params: { instituteId, userId },
  });

  console.log("📥 Received student details API response:", response.status, response.data);
  return response;
};

// ⚙️ React Query config
export const getStudentDetails = (instituteId?: string, userId?: string) => {
  return {
    queryKey: ["STUDENT_DETAILS", instituteId, userId],
    queryFn: async () => {
      console.log("🔁 queryFn triggered");

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

// 🔐 Fetch and store student details + sessions
export const fetchAndStoreStudentDetails = async (
  instituteId: string,
  userId: string
) => {
  try {
    console.log("🚀 fetchAndStoreStudentDetails called:", { instituteId, userId });

    const { queryFn } = getStudentDetails(instituteId, userId);
    const response = await queryFn();

    console.log("✅ API response received with status:", response.status);

    if (response.status === 200) {
      const students: Student[] = response.data;
      console.log("👨‍🎓 Students fetched:", students);

      await Preferences.set({
        key: "students",
        value: JSON.stringify(students),
      });
      console.log("💾 Stored 'students' in Preferences");

      if (students.length > 0) {
        await Preferences.set({
          key: "StudentDetails",
          value: JSON.stringify(students[0]),
        });
        console.log("💾 Stored first student in 'StudentDetails'");
      }

      const instituteData = await Preferences.get({ key: "InstituteDetails" });
      console.log("🏢 InstituteDetails from Preferences:", instituteData);

      if (!instituteData.value) throw new Error("No institute data found!");

      const institute: Institute = JSON.parse(instituteData.value);

      if (!institute.batches_for_sessions)
        throw new Error("No batches found in institute details!");

      const packageSessionIds = students.map((s) => s.package_session_id);
      const matchedSessions = institute.batches_for_sessions.filter((batch: Batch) =>
        packageSessionIds.includes(batch.id)
      );

      console.log("🎯 Matched sessions:", matchedSessions);

      await Preferences.set({
        key: "sessionList",
        value: JSON.stringify(matchedSessions),
      });
      console.log("💾 Stored 'sessionList' in Preferences");

      await storeMappedSessions();
    } else if (response.status === 201) {
      const student: Student = response.data[0];

      await Preferences.set({
        key: "StudentDetails",
        value: JSON.stringify(student),
      });
      await Preferences.set({
        key: "students",
        value: JSON.stringify([student]),
      });

      console.log("💾 Stored single student response (201) in Preferences");
    }

    // ✅ Confirmation logs
    console.log("🧾 Final Stored StudentDetails:", await Preferences.get({ key: "StudentDetails" }));
    console.log("🧾 Final Stored students:", await Preferences.get({ key: "students" }));

    return response.status;
  } catch (error) {
    console.error("❌ Failed to fetch and store student details:", error);
    throw error;
  }
};

// 🗂️ Store mapped sessions
const storeMappedSessions = async () => {
  try {
    console.log("📦 storeMappedSessions called");

    const studentData = await Preferences.get({ key: "students" });
    console.log("📂 Retrieved students from Preferences:", studentData.value);

    const students: Student[] = studentData.value ? JSON.parse(studentData.value) : [];

    const instituteData = await Preferences.get({ key: "InstituteDetails" });
    console.log("🏢 Retrieved InstituteDetails:", instituteData.value);

    if (!instituteData.value) throw new Error("No institute data found!");

    const institute: Institute = JSON.parse(instituteData.value);
    const sessionIds = students.map((s) => s.package_session_id);

    const matchedSessions =
      institute.batches_for_sessions?.filter((batch: Batch) =>
        sessionIds.includes(batch.id)
      ) || [];

    console.log("🎯 Mapped sessions for students:", matchedSessions);

    await Preferences.set({
      key: "sessionList",
      value: JSON.stringify(matchedSessions),
    });

    console.log("💾 Stored sessionList via storeMappedSessions()");
  } catch (error) {
    console.error("❌ Error in storeMappedSessions:", error);
  }
};

// 🧠 Get stored students
export const getStoredStudentDetails = async (): Promise<Student[] | null> => {
  try {
    const { value } = await Preferences.get({ key: "students" });
    console.log("📥 getStoredStudentDetails ->", value);
    return value ? (JSON.parse(value) as Student[]) : null;
  } catch (error) {
    console.error("❌ Error parsing stored student details:", error);
    return null;
  }
};

// 📚 Get matched sessions from Preferences
export const getMappedSessions = async (): Promise<Batch[] | null> => {
  try {
    console.log("🔎 getMappedSessions called");

    let studentData = await Preferences.get({ key: "students" });
    console.log("📥 students:", studentData.value);

    if (!studentData.value) {
      studentData = await Preferences.get({ key: "StudentDetails" });
      console.log("📥 fallback StudentDetails:", studentData.value);

      if (!studentData.value) {
        console.warn("⚠️ No student data found in Preferences");
        return null;
      }
    }

    const student: Student = JSON.parse(studentData.value);

    const instituteData = await Preferences.get({ key: "InstituteDetails" });
    console.log("🏢 InstituteDetails:", instituteData.value);

    if (!instituteData.value) {
      console.warn("⚠️ No institute data available");
      return null;
    }

    const institute: Institute = JSON.parse(instituteData.value);

    if (!institute.batches_for_sessions || institute.batches_for_sessions.length === 0) {
      console.warn("⚠️ No batches found in institute");
      return null;
    }

    const matchedSessions = institute.batches_for_sessions.filter(
      (batch: Batch) => batch.id === student.package_session_id
    );

    if (matchedSessions.length === 0) {
      console.warn("⚠️ No matching sessions found for student's package_session_id");
      return null;
    }

    console.log("✅ Found matching sessions:", matchedSessions);
    return matchedSessions;
  } catch (error) {
    console.error("❌ Error mapping sessions:", error);
    return null;
  }
};
