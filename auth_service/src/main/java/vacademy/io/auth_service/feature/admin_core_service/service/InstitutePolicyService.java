package vacademy.io.auth_service.feature.admin_core_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.admin_core_service.dto.InstituteSignupPolicy;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;

@Service
public class InstitutePolicyService {

    @Autowired
    private InternalClientUtils internalClientUtils;

    @Value("${spring.application.name}")
    private String applicationName;

    @Value("${admin.core.service.base_url}")
    private String adminCoreServiceBaseUrl;

    public InstituteSignupPolicy fetchSignupPolicy(String instituteId) {
        if (!StringUtils.hasText(instituteId))
            return null;
        try {
            ResponseEntity<String> resp = internalClientUtils.makeHmacRequest(
                    applicationName,
                    HttpMethod.GET.name(),
                    adminCoreServiceBaseUrl,
                    "/admin-core-service/public/institute/v1/details/" + instituteId,
                    null);
            if (resp == null || resp.getBody() == null)
                return null;

            ObjectMapper mapper = new ObjectMapper();
            JsonNode institute = mapper.readTree(resp.getBody());
            String settingJson = institute.has("setting") && !institute.get("setting").isNull()
                    ? institute.get("setting").asText()
                    : null;
            if (!StringUtils.hasText(settingJson))
                return null;

            JsonNode settingNode = mapper.readTree(settingJson).get("setting");
            if (settingNode == null)
                return null;

            String passwordStrategy = null;
            String passwordDelivery = null;
            String usernameStrategy = null;
            boolean allowCreateCourses = false;

            JsonNode studentDisplay = settingNode.get("STUDENT_DISPLAY_SETTINGS");
            if (studentDisplay != null && studentDisplay.has("data")) {
                JsonNode data = studentDisplay.get("data");
                JsonNode signup = data.get("signup");
                if (signup != null) {
                    if (signup.has("passwordStrategy"))
                        passwordStrategy = signup.get("passwordStrategy").asText();
                    if (signup.has("passwordDelivery"))
                        passwordDelivery = signup.get("passwordDelivery").asText();
                    if (signup.has("usernameStrategy"))
                        usernameStrategy = signup.get("usernameStrategy").asText();
                }
            }

            JsonNode courseSetting = settingNode.get("COURSE_SETTING");
            if (courseSetting != null && courseSetting.has("data")) {
                JsonNode perm = courseSetting.get("data").get("permissions");
                if (perm != null && perm.has("allowLearnersToCreateCourses")) {
                    allowCreateCourses = perm.get("allowLearnersToCreateCourses").asBoolean(false);
                }
            }

            return InstituteSignupPolicy.builder()
                    .passwordStrategy(passwordStrategy)
                    .passwordDelivery(passwordDelivery)
                    .allowLearnersToCreateCourses(allowCreateCourses)
                    .userNameStrategy(usernameStrategy)
                    .build();
        } catch (Exception e) {
            return null;
        }
    }
}

