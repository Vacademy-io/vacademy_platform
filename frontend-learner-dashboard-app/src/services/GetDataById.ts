import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";

export const fetchDataByIds = async (id:string , url:string) => {
  try {
    const response = await authenticatedAxiosInstance.get(`${url}`, {
      params: {
        richTextIds: id,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching assessments:", error);
    // toast.error("Failed to fetch assessments.");
  }
};
