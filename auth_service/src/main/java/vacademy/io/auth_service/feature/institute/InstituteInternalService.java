package vacademy.io.auth_service.feature.institute;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;

@Service
public class InstituteInternalService {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${admin.core.service.baseurl}")
    private String adminCoreServerBaseUrl;

    public InstituteInfoDTO getInstituteByInstituteId(String instituteId) {
        ResponseEntity<String> response = internalClientUtils.makeHmacRequest(
                clientName,
                HttpMethod.GET.name(),
                adminCoreServerBaseUrl,
                "/admin-core-service/internal/institute/v1/" + instituteId,
                null
        );

        if (response.getBody() == null || response.getBody().isBlank()) {
            return null;
        }
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(response.getBody(), InstituteInfoDTO.class);
        } catch (Exception e) {
            throw new VacademyException("Failed to parse institute data: " + e.getMessage());
        }
    }
}

