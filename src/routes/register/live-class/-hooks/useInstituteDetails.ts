import { useQuery } from "@tanstack/react-query";
import { Preferences } from "@capacitor/preferences";
import { getPublicUrl } from "@/services/upload_file";

interface InstituteDetails {
  institute_name: string;
  institute_logo_file_id: string | null;
  id: string;
}

const getInstituteDetails = async () => {
  const { value } = await Preferences.get({ key: "InstituteDetails" });
  if (!value) return null;

  const details: InstituteDetails = JSON.parse(value);
  const logoUrl = details.institute_logo_file_id
    ? await getPublicUrl(details.institute_logo_file_id)
    : null;

  return {
    ...details,
    logoUrl,
  };
};

export const useInstituteDetails = () => {
  return useQuery({
    queryKey: ["instituteDetails"],
    queryFn: getInstituteDetails,
  });
};
