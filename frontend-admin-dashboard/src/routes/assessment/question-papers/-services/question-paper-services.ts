import { UPLOAD_DOCS_FILE_URL } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";

export const uploadDocsFile = async (
    questionIdentifier: string,
    optionIdentifier: string,
    answerIdentifier: string,
    explanationIdentifier: string,
    file: File,
    setUploadProgress: React.Dispatch<React.SetStateAction<number>>,
) => {
    const formData = new FormData();
    formData.append("file", file);
    try {
        const response = await authenticatedAxiosInstance({
            method: "POST",
            url: `${UPLOAD_DOCS_FILE_URL}`,
            headers: {
                "Content-Type": "multipart/form-data",
            },
            params: {
                questionIdentifier,
                optionIdentifier,
                answerIdentifier,
                explanationIdentifier,
            },
            data: formData,
            onUploadProgress: (progressEvent) => {
                const total = progressEvent.total ?? file.size; // Total size of the file
                const percentCompleted = Math.round((progressEvent.loaded / total) * 100);
                setUploadProgress(percentCompleted);
            },
        });
        return response?.data;
    } catch (error: unknown) {
        throw new Error(`Error uploading file: ${error}`);
    }
};
