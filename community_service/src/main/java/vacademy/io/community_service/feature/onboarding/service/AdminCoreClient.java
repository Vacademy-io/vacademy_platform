package vacademy.io.community_service.feature.onboarding.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

import java.util.Map;

/** Thin internal-API client for the few admin-core calls the demo-management flow needs. */
@Service
@Slf4j
public class AdminCoreClient {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String clientName;

    @Value("${ADMIN_CORE_SERVICE_BASE_URL:http://admin-core-service:8072}")
    private String adminCoreBaseUrl;

    /**
     * Rename a live institute so a prospect sees the updated branding inside the demo.
     * Best-effort: failures are logged and surfaced to the caller via a thrown exception only
     * when explicitly requested.
     */
    public void renameInstitute(String instituteId, String instituteName) {
        String route = "/admin-core-service/internal/institute/v1/" + instituteId + "/profile";
        internalClientUtils.makeHmacRequest(
                clientName, HttpMethod.PUT.name(), adminCoreBaseUrl, route,
                Map.of("instituteName", instituteName == null ? "" : instituteName));
        log.info("Renamed demo institute {} to '{}'", instituteId, instituteName);
    }
}
