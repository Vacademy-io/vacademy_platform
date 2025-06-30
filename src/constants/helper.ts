import {
  getTokenDecodedData,
  getTokenFromStorage,
} from "@/lib/auth/sessionUtility";
import { TokenKey } from "./auth/tokens";
// import { PrivacyScreen } from "@capacitor-community/privacy-screen";

export function convertToLocalDateTime(utcDate: string): string {
  if (!utcDate) return '';

  const date = new Date(utcDate);
  console.log("[convertToLocalDateTime] Input UTC:", utcDate);
  console.log("[convertToLocalDateTime] Converted Date Object:", date);

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  };

  const formatted = new Intl.DateTimeFormat('en-GB', options).format(date);
  const finalString = formatted.replace(',', '').replace(/\s(am|pm)/i, (match) => match.toUpperCase());

  console.log("[convertToLocalDateTime] Final formatted string:", finalString);
  return finalString;
}

export function extractDateTime(utcDate: string) {
  const [date, time] = [
    utcDate.split(" ").slice(0, 3).join(" "),
    utcDate.split(" ").slice(3).join(" "),
  ];

  console.log("[extractDateTime] Extracted date:", date);
  console.log("[extractDateTime] Extracted time:", time);

  return { date, time };
}

export async function getInstituteId() {
  const accessToken = await getTokenFromStorage(TokenKey.accessToken);
  console.log("[getInstituteId] Access token:", accessToken);

  const data = accessToken ? await getTokenDecodedData(accessToken) : null;
  console.log("[getInstituteId] Decoded token data:", data);

  const INSTITUTE_ID = data && Object.keys(data.authorities)[0];
  console.log("[getInstituteId] Extracted Institute ID:", INSTITUTE_ID);

  return INSTITUTE_ID;
}


interface Subject {
  id: string;
  subject_name: string;
}

export const getSubjectNameById = (subjects: Subject[], id: string | null): string => {
  console.log("[getSubjectNameById] Subject list:", subjects);
  console.log("[getSubjectNameById] Looking for ID:", id);

  const subject = subjects.find((item: Subject) => item.id === id);

  console.log("[getSubjectNameById] Found subject:", subject);
  return subject?.subject_name || "N/A";
};

export const formatDuration = (durationInSeconds: number): string => {
  console.log("[formatDuration] Duration in seconds:", durationInSeconds);

  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = durationInSeconds % 60;

  console.log("[formatDuration] Parsed:", { hours, minutes, seconds });

  if (hours === 0 && minutes === 0 && seconds > 0) {
    return `${seconds} sec`;
  }

  const formattedDuration = `${hours > 0 ? `${hours} hr ` : ""}${minutes > 0 ? `${minutes} min ` : ""}${seconds > 0 ? `${seconds} sec` : ""}`.trim();
  console.log("[formatDuration] Final formatted string:", formattedDuration);

  return formattedDuration;
};
