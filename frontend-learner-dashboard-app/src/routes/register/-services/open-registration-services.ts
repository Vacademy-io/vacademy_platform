import {
  GET_OPEN_REGISTRATION_DETAILS,
  GET_PARTICIPANTS_STATUS,
  GET_USERID_URL,
  REGISTER_PARTICIPANT_URL,
  STUDENT_DETAIL,
} from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import axios from "axios";
import {
  mergeDataToGetUserId,
  transformIntoCustomFieldRequestListData,
} from "../-utils/helper";
import {
  AssessmentCustomFieldOpenRegistration,
  DynamicSchemaData,
  ParticipantsDataInterface,
} from "@/types/assessment-open-registration";

const handleGetOpenTestRegistrationDetails = async (code: string | number) => {
  const response = await axios({
    method: "GET",
    url: GET_OPEN_REGISTRATION_DETAILS,
    params: {
      code: code,
    },
  });
  return response?.data;
};
export const getOpenTestRegistrationDetails = (code: string | number) => {
  return {
    queryKey: ["GET_OPEN_REGISTRATION_DETAILS", code],
    queryFn: () => handleGetOpenTestRegistrationDetails(code),
    staleTime: 3600000,
  };
};

export const handleGetParticipantsTest = async (
  assessmentId: string,
  instituteId: string,
  userId: string | undefined,
  psIds?: string
) => {
  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: GET_PARTICIPANTS_STATUS,
    params: {
      assessmentId,
      instituteId,
      userId,
      ...(psIds && { psIds }),
    },
  });
  return response?.data;
};

export const handleRegisterOpenParticipant = async (
  assessment_custom_fields: AssessmentCustomFieldOpenRegistration[],
  institute_id: string,
  assessment_id: string,
  participantsDto: ParticipantsDataInterface,
  custom_field_request_list: DynamicSchemaData
) => {
  const response = await axios({
    method: "POST",
    url: REGISTER_PARTICIPANT_URL,
    params: {
      userId: participantsDto.user_id,
    },
    data: {
      institute_id: institute_id,
      assessment_id: assessment_id,
      participant_dto: participantsDto,
      custom_field_request_list: transformIntoCustomFieldRequestListData(
        assessment_custom_fields,
        custom_field_request_list
      ).custom_field_request_list,
    },
  });
  return response?.data;
};

export const handleGetStudentDetailsOfInstitute = async (
  instituteId: string
) => {
  const response = await authenticatedAxiosInstance({
    method: "GET",
    url: STUDENT_DETAIL,
    params: {
      instituteId,
    },
  });
  return response?.data;
};

export const handleGetUserId = async (
  instituteId: string,
  data: DynamicSchemaData
) => {
  const data1 = {
    id: "",
    username: "",
    email: "",
    full_name: "",
    address_line: "",
    city: "",
    region: "",
    pin_code: "",
    mobile_number: "",
    date_of_birth: "",
    gender: "",
    password: "",
    profile_pic_file_id: "",
    roles: [],
    root_user: true,
  };
  const response = await axios({
    method: "POST",
    url: GET_USERID_URL,
    params: {
      instituteId,
    },
    data: mergeDataToGetUserId(data1, data),
  });
  return response?.data;
};
