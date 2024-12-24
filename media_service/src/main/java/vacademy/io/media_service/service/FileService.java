package vacademy.io.media_service.service;


import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.media_service.dto.AcknowledgeRequest;
import vacademy.io.media_service.dto.PreSignedUrlResponse;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.exceptions.FileUploadException;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.io.IOException;
import java.util.List;
import java.util.Map;

public interface FileService {
    String uploadFile(CustomUserDetails userDetails, MultipartFile multipartFile) throws FileUploadException, IOException;

    Object downloadFile(CustomUserDetails userDetails,String fileName) throws FileDownloadException, IOException;

    PreSignedUrlResponse getPreSignedUrl(CustomUserDetails userDetails,String fileName, String fileType, String source, String sourceId);

    String getPublicUrlWithExpiry(CustomUserDetails userDetails,String key, Integer days) throws FileDownloadException;

    String getPublicUrlWithExpiryAndId(CustomUserDetails userDetails,String id) throws FileDownloadException;

    Boolean acknowledgeClientUpload(CustomUserDetails userDetails,AcknowledgeRequest acknowledgeRequest);

    boolean delete(CustomUserDetails userDetails,String fileName);

    String getPublicUrlWithExpiryAndSource(CustomUserDetails userDetails,String source, String sourceId, Integer expiryDays) throws FileDownloadException;

    List<Map<String, String>> getMultiplePublicUrlWithExpiryAndId(CustomUserDetails userDetails,String fileIds);

    List<Map<String, String>> getMultipleUrlWithExpiryAndId(CustomUserDetails userDetails,String fileIds, Integer expiryDays);

    String getUrlWithExpiryAndId(CustomUserDetails userDetails,String id, Integer days) throws FileDownloadException;

    FileDetailsDTO getFileDetailsWithExpiryAndId(CustomUserDetails userDetails,String id, Integer days) throws FileDownloadException;

    List<FileDetailsDTO> getMultipleFileDetailsWithExpiryAndId(CustomUserDetails userDetails,String ids, Integer days) throws FileDownloadException;
}