import { useAssessmentStore } from "@/stores/assessment-store";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { toast } from "sonner";
import {
  Assessment_List_Filter,
  ASSESSMENT_PREVIEW,
  START_ASSESSMENT,
} from "@/constants/urls";
import { Preferences } from "@capacitor/preferences";
import {
  assessmentTypes,
  distribution_duration_types,
  SectionDto,
} from "@/types/assessment";
import { Storage } from "@capacitor/storage";

const getStoredDetails = async () => {
  const studentData = await Preferences.get({ key: "StudentDetails" });
  const instituteData = await Preferences.get({ key: "InstituteDetails" });

  const student = studentData.value ? JSON.parse(studentData.value) : null;
  const institute = instituteData.value
    ? JSON.parse(instituteData.value)
    : null;

  return { student, institute };
};

const getStartAssessmentDetails = async () => {
  const InstructionID_and_AboutID = await Preferences.get({
    key: "InstructionID_and_AboutID",
  });
  const assessment_questions = await Preferences.get({
    key: "Assessment_questions",
  });

  const assessment = InstructionID_and_AboutID.value
    ? JSON.parse(InstructionID_and_AboutID.value)
    : null;
  const questions = assessment_questions.value
    ? JSON.parse(assessment_questions.value)
    : null;

  return {
    assessment_id: assessment.assessment_id,
    user_id: questions.assessment_user_registration_id,
    attempt_id: questions.attempt_id,
  };
};

const getDuration = async (): Promise<{
  can_switch_section: boolean;
  duration: number;
  distribution_duration: distribution_duration_types;
}> => {
  const InstructionID_and_AboutID = await Preferences.get({
    key: "InstructionID_and_AboutID",
  });

  const assessment = InstructionID_and_AboutID.value
    ? JSON.parse(InstructionID_and_AboutID.value)
    : null;

  return {
    can_switch_section: assessment?.can_switch_section || false,
    duration: assessment?.duration || 1,
    distribution_duration: assessment?.distribution_duration || "QUESTION",
  };
};

export const fetchAssessmentData = async (
  pageNo: number,
  pageSize: number,
  assessmentType: assessmentTypes,
  assessment_types: string
) => {
  try {
    const { student, institute } = await getStoredDetails();
    if (!student || !institute) {
      toast.error("Missing student or institute details.");
      return;
    }

    const requestBody = {
      name: "",
      batch_ids: [student.package_session_id],
      user_ids: [student.user_id],
      tag_ids: [],
      assessment_types: [assessment_types],
      get_live_assessments: assessmentType === assessmentTypes.LIVE,
      get_passed_assessments: assessmentType === assessmentTypes.PAST,
      get_upcoming_assessments: assessmentType === assessmentTypes.UPCOMING,
      institute_ids: [institute.id],
      sort_columns: {},
    };

    const response = await authenticatedAxiosInstance.post(
      `${Assessment_List_Filter}`,
      requestBody,
      {
        params: {
          pageNo: pageNo,
          pageSize: pageSize,
          instituteId: institute.id,
        },
      }
    );
    return response.data;
  } catch {
    console.error("Error fetching assessments:");
  } finally {
    // setLoading(false);
  }
};

export const storeAssessmentInfo = async (assessmentInfo: any) => {
  await Storage.set({
    key: "InstructionID_and_AboutID",
    value: JSON.stringify(assessmentInfo),
  });
};

export const fetchPreviewData = async (assessment_id: string) => {
  try {
    const { student, institute } = await getStoredDetails();
    if (!student || !institute) {
      toast.error("Missing student or institute details.");
      return;
    }

    const getStudentDetails = async () => {
      const storedData = await Storage.get({ key: "StudentDetails" });
      if (storedData.value) {
        try {
          return JSON.parse(storedData.value);
        } catch (error) {
          console.error("Error parsing student details:", error);
        }
      }
    };

    const getInstituteId = async () => {
      const institute_id_value = await Storage.get({ key: "InstituteId" });
      return institute_id_value.value || null;
    };

    const institute_id = await getInstituteId();
    const student_details = await getStudentDetails();

    if (!student_details) {
      toast.error("Student details not found.");
      return;
    }

    const requestBody = {
      username: student_details.username,
      user_id: student_details.user_id,
      email: student_details.email,
      full_name: student_details.full_name,
      mobile_number: student_details.mobile_number,
      file_id: null,
      guardian_email: student_details.parents_email,
      guardian_mobile_number: student_details.parents_mobile_number,
      reattempt_count: 3,
    };

    const response = await authenticatedAxiosInstance.post(
      `${ASSESSMENT_PREVIEW}`,
      requestBody,
      {
        params: {
          batch_ids: student_details.package_session_id,
          instituteId: institute_id,
          assessment_id: assessment_id,
        },
      }
    );

    const durationData = await getDuration();
    if (response.status === 200) {
      // Clone response data to avoid direct mutation
      const responseData = { ...response.data, ...durationData };

      // Iterate over sections to check for randomization
      responseData.section_dtos = responseData.section_dtos.map(
        (section: SectionDto) => {
          if (
            section.problem_randomization === "RANDOM" &&
            Array.isArray(section.question_preview_dto_list)
          ) {
            section.question_preview_dto_list = shuffleArray(
              section.question_preview_dto_list
            );
          }
          // Assign serial question numbers
          section.question_preview_dto_list =
            section.question_preview_dto_list.map((question, index) => ({
              ...question,
              serial_number: index + 1,
            }));
          return section;
        }
      );

      // Save to local storage
      await Storage.set({
        key: "Assessment_questions",
        value: JSON.stringify(responseData),
      });

      // Update the state
      useAssessmentStore.setState((state) => ({
        ...state,
        assessment: responseData,
      }));
    }

    return response.data;
    // if (response.status === 200) {
    //   // Save to local storage
    //   await Storage.set({
    //     key: "Assessment_questions",
    //     value: JSON.stringify({ ...response.data, ...durationData }),
    //   });

    //   useAssessmentStore.setState((state) => ({
    //     ...state,
    //     assessment: { ...response.data, ...durationData },
    //   }));
    // }

    // return response.data;
  } catch (error) {
    console.error("Error fetching assessments:", error);
  }
};

export const startAssessment = async () => {
  try {
    const { assessment_id, user_id, attempt_id } =
      await getStartAssessmentDetails();

    const requestBody = {
      assessment_id: assessment_id,
      user_registration_id: user_id,
      attempt_id: attempt_id,
    };

    const response = await authenticatedAxiosInstance.post(
      `${START_ASSESSMENT}`,
      requestBody
    );
    if (response.status === 200) {
      await Storage.set({
        key: "server_start_end_time",
        value: JSON.stringify(response.data),
      });
      return response.data;
    }
  } catch (error) {
    console.error("Error fetching assessments:", error);
    // toast.error("Failed to fetch assessments.");
  } finally {
    // setLoading(false);
  }
};

// Utility function to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array: any[]) {
  const shuffledArray = [...array];
  for (let i = shuffledArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]];
  }
  return shuffledArray;
}

// export const updateAssessmentAccordingToApiResponse = async (
//   UpdateApiResponse: UpdateApiResponse
// ) => {
//   const Assessment_question = await Preferences.get({
//     key: "Assessment_questions",
//   });
//   const assessment = Assessment_question.value
//     ? JSON.parse(Assessment_question.value)
//     : null;
// };
