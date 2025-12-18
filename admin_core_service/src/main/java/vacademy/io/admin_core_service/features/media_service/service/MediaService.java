package vacademy.io.admin_core_service.features.media_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.media_service.constants.MediaServiceConstants;
import vacademy.io.admin_core_service.features.notification.constants.NotificationConstant;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.io.IOException;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class MediaService {
    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${media.server.baseurl}")
    private String mediaServerBaseUrl;

    @Autowired
    private ObjectMapper objectMapper;

    public String getFileUrlById(String fileId) {
        if (fileId == null || fileId.isEmpty()) {
            return null;
        }
        // Removed the redundant 'clientName' parameter, we can use the injected clientName field here
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.GET.name(),
                mediaServerBaseUrl,
                MediaServiceConstants.GET_FILE_URL_BY_ID_ROUTE+"?fileId="+fileId+"&expiryDays=1",
                null
        );
        return response.getBody();
    }

    public String getFilePublicUrlById(String fileId) {
        if (fileId == null || fileId.isEmpty()) {
            return null;
        }
        // Removed the redundant 'clientName' parameter, we can use the injected clientName field here
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.GET.name(),
                mediaServerBaseUrl,
                MediaServiceConstants.GET_FILE_PUBLIC_URL_BY_ID_ROUTE+"?fileId="+fileId+"&expiryDays=1",
                null
        );
        return response.getBody();
    }

    public String uploadFile(MultipartFile multipartFile) throws IOException {
        if (multipartFile == null) {
            return null;
        }
        // Removed the redundant 'clientName' parameter, we can use the injected clientName field here
        ResponseEntity<String> response = internalClientUtils.makeHmacRequestForMultipartFile(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.PUT.name(),
                mediaServerBaseUrl,
                MediaServiceConstants.GET_FILE_UPLOAD_ENDPOINT,
                multipartFile
        );
        return response.getBody();
    }

    public FileDetailsDTO uploadFileV2(MultipartFile multipartFile) throws IOException {
        if (multipartFile == null) {
            return null;
        }
        // Removed the redundant 'clientName' parameter, we can use the injected clientName field here
        ResponseEntity<String> response = internalClientUtils.makeHmacRequestForMultipartFile(
                clientName, // Directly use the injected 'clientName'
                HttpMethod.POST.name(),
                mediaServerBaseUrl,
                MediaServiceConstants.GET_FILE_UPLOAD_ENDPOINT_V2,
                multipartFile
        );
        String body = response.getBody();
        return objectMapper.readValue(body, FileDetailsDTO.class);
    }

    public List<FileDetailsDTO> getFilesByIds(List<String> fileIds) {
        if (fileIds == null || fileIds.isEmpty()) {
            return List.of();
        }

        String commaSeparatedFileIds = String.join(",", fileIds);

        try {
            ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                mediaServerBaseUrl,
                MediaServiceConstants.GET_MULTIPLE_FILES_BY_ID_ROUTE + "?fileIds=" + commaSeparatedFileIds + "&expiryDays=1",
                null
            );

            String body = response.getBody();
            if (body == null || body.isBlank()) {
                return List.of();
            }

            return objectMapper.readValue(body, new com.fasterxml.jackson.core.type.TypeReference<List<FileDetailsDTO>>() {});
        } catch (Exception e) {
            e.printStackTrace();
            return List.of();
        }
    }

    /**
     * Get public URL without expiry (permanent public URL)
     * Uses the public endpoint that returns direct S3 URLs
     */
    public String getFilePublicUrlByIdWithoutExpiry(String fileId) {
        if (fileId == null || fileId.isEmpty()) {
            return null;
        }
        // Use public endpoint that returns permanent URL without expiry
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                mediaServerBaseUrl,
                "/media-service/public/get-public-url?fileId=" + fileId,
                null
        );
        return response.getBody();
    }

}
