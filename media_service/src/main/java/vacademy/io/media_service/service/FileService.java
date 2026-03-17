package vacademy.io.media_service.service;

import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.dto.AcknowledgeRequest;
import vacademy.io.media_service.dto.PreSignedUrlResponse;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.exceptions.FileUploadException;

import java.io.IOException;
import java.util.List;
import java.util.Map;

public interface FileService {
    String uploadFile(MultipartFile multipartFile) throws FileUploadException, IOException;

    FileDetailsDTO uploadFileWithDetails(MultipartFile multipartFile) throws FileUploadException, IOException;

    Object downloadFile(String fileName) throws FileDownloadException, IOException;

    PreSignedUrlResponse getPreSignedUrl(String fileName, String fileType, String source, String sourceId);

    String getPublicUrlWithExpiry(String key, Integer days) throws FileDownloadException;

    String getPublicUrlWithExpiryAndId(String id) throws FileDownloadException;

    Boolean acknowledgeClientUpload(AcknowledgeRequest acknowledgeRequest);

    boolean delete(String fileName);

    String getPublicUrlWithExpiryAndSource(String source, String sourceId, Integer expiryDays)
            throws FileDownloadException;

    List<Map<String, String>> getMultiplePublicUrlWithExpiryAndId(String fileIds);

    List<Map<String, String>> getMultipleUrlWithExpiryAndId(String fileIds, Integer expiryDays);

    String getUrlWithExpiryAndId(String id, Integer days) throws FileDownloadException;

    FileDetailsDTO getFileDetailsWithExpiryAndId(String id, Integer days) throws FileDownloadException;

    List<FileDetailsDTO> getMultipleFileDetailsWithExpiryAndId(String ids, Integer days) throws FileDownloadException;

    FileDetailsDTO acknowledgeClientUploadAndGetPublicUrl(AcknowledgeRequest acknowledgeRequest);

    PreSignedUrlResponse getPublicPreSignedUrl(String fileName, String fileType, String source, String sourceId);

    String getPublicBucketUrl(String fileId, Integer expiryDays) throws FileDownloadException;

    String getPublicUrl(String id, String bucketName);

    FileDetailsDTO uploadFileToKey(MultipartFile multipartFile, String key) throws FileUploadException, IOException;
}