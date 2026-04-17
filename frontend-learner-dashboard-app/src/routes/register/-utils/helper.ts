import {
  AssessmentCustomFieldOpenRegistration,
  DynamicSchemaData,
  OpenRegistrationUserDetails,
} from "@/types/assessment-open-registration";
import { UserDetailsOpenTest } from "@/types/open-test";
import { z } from "zod";

const parseBackendDate = (raw: string): number => {
  // Backend may send timestamps with or without an explicit timezone.
  // Without a zone marker, modern browsers parse the string as *local*
  // time, which makes the countdown drift by the local UTC offset.
  // Force UTC interpretation when no zone marker is present.
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/i.test(raw);
  const normalized = hasTimezone ? raw : `${raw.replace(" ", "T")}Z`;
  return new Date(normalized).getTime();
};

export const calculateTimeDifference = (
  serverTime: number,
  startDate: string
) => {
  if (!startDate) return false;
  const startTime = parseBackendDate(startDate);
  if (isNaN(startTime)) return false;

  const difference: number = startTime - serverTime;

  return difference > 0 ? true : false;
};

export const calculateTimeLeft = (serverTime: number, startDate: string) => {
  if (!startDate) return { hours: 0, minutes: 0, seconds: 0 };
  const startTime = parseBackendDate(startDate);
  if (isNaN(startTime)) return { hours: 0, minutes: 0, seconds: 0 };

  const difference: number = startTime - serverTime;

  if (difference <= 0) {
    return { hours: 0, minutes: 0, seconds: 0 }; // Assessment already started
  }

  return {
    hours: Math.floor(difference / (1000 * 60 * 60)),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
};

export const getDynamicSchema = (
  formFields: AssessmentCustomFieldOpenRegistration[]
) => {
  const dynamicSchema = z.object(
    formFields.reduce<Record<string, z.ZodTypeAny>>((schema, field) => {
      if (field.field_type === "dropdown") {
        const options = field.comma_separated_options
          ? field.comma_separated_options.split(",").map((opt) => opt.trim())
          : [];

        schema[field.field_key] = z.object({
          id: z.string().optional(),
          name: z.string(),
          value:
            field.is_mandatory
              ? z.string().min(1, `${field.field_name} is required`)
              : z.string(),
          is_mandatory: z.boolean(),
          type: z.string(),
          comma_separated_options: z.array(z.string()).optional(),
        });
      } else {
        schema[field.field_key] = z.object({
          id: z.string().optional(),
          name: z.string(),
          value: field.is_mandatory
            ? z.string().min(1, `${field.field_name} is required`)
            : z.string(),
          is_mandatory: z.boolean(),
          type: z.string(),
        });
      }
      return schema;
    }, {})
  );

  return dynamicSchema;
};

export const getOpenRegistrationUserDetailsByEmail = (
  users: UserDetailsOpenTest[],
  email: string | undefined
): UserDetailsOpenTest | null => {
  return users.find((user) => user.email === email) || null;
};

export function transformIntoCustomFieldRequestListData(
  data1: AssessmentCustomFieldOpenRegistration[],
  data2: DynamicSchemaData
) {
  return {
    custom_field_request_list: data1.map((field) => ({
      id: field.id,
      assessment_custom_field_id: field.id,
      assessment_custom_field_key: field.field_key,
      answer: data2[field.field_key]?.value || "",
    })),
  };
}

export function mergeDataToGetUserId(
  data1: OpenRegistrationUserDetails,
  data2: DynamicSchemaData
): OpenRegistrationUserDetails {
  const result: OpenRegistrationUserDetails = { ...data1 }; // Copy structure

  Object.keys(result).forEach((key) => {
    if (
      key in data2 &&
      typeof data2[key as keyof DynamicSchemaData] === "object" &&
      "value" in data2[key as keyof DynamicSchemaData]
    ) {
      const value = data2[key as keyof DynamicSchemaData].value;

      if (
        typeof value === "string" &&
        typeof result[key as keyof OpenRegistrationUserDetails] === "string"
      ) {
        (result[key as keyof OpenRegistrationUserDetails] as string) = value;
      }
    }
  });

  return result;
}
