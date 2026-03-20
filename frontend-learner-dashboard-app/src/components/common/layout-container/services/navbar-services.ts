import { BASE_URL } from "@/constants/urls";
import axios from "axios";
import { getInstituteIdSync } from "../../helper";

export const getPublicInstituteDetails = async () => {
  const instituteId = await getInstituteIdSync();
  if (!instituteId) {
    throw new Error("Institute ID not available");
  }
  try {
    const response = await axios.get(
      `${BASE_URL}/admin-core-service/public/institute/v1/details-non-batches/${instituteId}`
    );
    return response.data;
  } catch (error) {
    console.log(error);
    throw new Error("Failed to fetch institute details");
  }
};

export const handleGetPublicInstituteDetails = () => {
  return {
    queryKey: ["GET_PUBLIC_INIT_INSTITUTE"],
    queryFn: () => getPublicInstituteDetails(),
    staleTime: 3600000,
  };
};
