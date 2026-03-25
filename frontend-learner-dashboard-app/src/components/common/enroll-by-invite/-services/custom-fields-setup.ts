import { GET_CUSTOM_FIELDS } from "@/constants/urls";
import axios, { AxiosResponse } from "axios";
export interface InsituteCustomField {
  custom_field_id: string;
  field_key: string;
  field_name: string;
  field_type: string;
  form_order: number | null;
  is_hidden: boolean | null;
  group_name: string | null;
  type: string;
  type_id: string | null;
  status: string;
  config?: string; // Optional config field for dropdown options, etc.
  is_mandatory?: boolean; // Optional is_mandatory field
  comma_separated_options?: string; // Optional comma_separated_options
}

export const getInstituteCustomFields = async ({
  instituteId,
}: {
  instituteId: string;
}) => {
  const response: AxiosResponse<InsituteCustomField[]> = await axios({
    method: "GET",
    url: GET_CUSTOM_FIELDS,
    params: {
      instituteId,
    },
  });
  return response?.data;
};

export const handleGetInstituteCustomFields = ({
  instituteId,
}: {
  instituteId: string;
}) => {
  return {
    queryKey: ["GET_INSTITUTE_CUSTOM_FIELDS", instituteId],
    queryFn: () => getInstituteCustomFields({ instituteId }),
    staleTime: 60 * 60 * 1000,
  };
};
