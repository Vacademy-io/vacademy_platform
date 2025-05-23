// hooks/use-file-upload.ts
import { useMutation } from "@tanstack/react-query";
import {
  UploadFileInS3,
  getPublicUrl,
  getPublicUrls,
} from "@/services/upload_file";

export const useFileUpload = () => {
  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      setIsUploading,
      userId,
      source,
      sourceId,
      // publicUrl,
    }: {
      file: File;
      setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
      userId: string;
      source?: string;
      sourceId?: string;
      publicUrl?: boolean;
    }) => {
      try {
        return await UploadFileInS3(
          file,
          setIsUploading,
          userId,
          source,
          sourceId
          // publicUrl,
        );
      } catch (error) {
        console.error("Upload error:", error);
        throw error;
      }
    },
  });

  const getUrlMutation = useMutation({
    mutationFn: async (fileId: string) => {
      try {
        return await getPublicUrl(fileId);
      } catch (error) {
        console.error("Get URL error:", error);
        throw error;
      }
    },
  });

  const getMultipleUrlMutation = useMutation({
    mutationFn: async (fileIds: string) => {
      try {
        return await getPublicUrls(fileIds);
      } catch (error) {
        console.error("Get URL error:", error);
        throw error;
      }
    },
  });

  return {
    uploadFile: uploadMutation.mutateAsync,
    getPublicUrl: getUrlMutation.mutateAsync,
    getMultiplePublicUrl: getMultipleUrlMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    isGettingUrl: getUrlMutation.isPending,
    error: uploadMutation.error || getUrlMutation.error,
  };
};
