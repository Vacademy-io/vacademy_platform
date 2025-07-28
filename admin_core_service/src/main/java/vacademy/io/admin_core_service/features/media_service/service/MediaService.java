package vacademy.io.admin_core_service.features.media_service.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.media_service.constants.MediaServiceConstants;
import vacademy.io.admin_core_service.features.notification.constants.NotificationConstant;
import vacademy.io.admin_core_service.features.notification.dto.NotificationDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.AttachmentNotificationDTO;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.util.List;

@Service
public class MediaService {
    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${media.server.baseurl}")
    private String mediaServerBaseUrl;

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
}
