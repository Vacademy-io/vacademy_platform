import { getInstituteId } from "@/constants/helper";
import { urlInstituteDetails } from "@/constants/urls";
import axios from "axios";

export const fetchInstituteDetails = async () => {
    const instituteId = await getInstituteId();
    const response = await axios({
        method: "GET",
        url: `${urlInstituteDetails}/${instituteId}`,
        params: {
            instituteId,
        },
    });
    return response?.data;
};

export const handleFetchInstituteDetails = () => {
    return {
        queryKey: ["FETCH_INSTITUTE_DETAILS"],
        queryFn: () => fetchInstituteDetails(),
        staleTime: 60 * 60 * 1000,
    };
};
