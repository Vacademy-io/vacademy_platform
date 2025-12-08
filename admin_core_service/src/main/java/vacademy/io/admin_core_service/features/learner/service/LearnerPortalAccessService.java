package vacademy.io.admin_core_service.features.learner.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.learner.dto.JwtResponseDto;
import vacademy.io.admin_core_service.features.learner.dto.LearnerPortalAccessResponse;
import vacademy.io.admin_core_service.features.learner.enums.LmsSourcesEnum;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.UserWithJwtDTO;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerPortalAccessService {

    private final InstituteRepository instituteRepository;
    private final InstituteSettingService instituteSettingService;
    private final InstituteDomainRoutingRepository domainRoutingRepository;
    private final InternalClientUtils internalClientUtils;
    private final WorkflowTriggerService workflowTriggerService;
    private final AuthService authService;


    @Value("${default.learner.portal.url}")
    private String defaultLearnerPortalUrl;

    public LearnerPortalAccessResponse generateLearnerPortalAccessUrl(String instituteId, String userId) {
        Institute institute = instituteRepository.findById(instituteId)
            .orElseThrow(() -> new VacademyException("Institute not found"));

        String activeLms = determineActiveLms(institute);
        UserWithJwtDTO userWithJwtDTO = authService.generateJwtTokensWithUser(userId,instituteId);
        if (activeLms.equalsIgnoreCase(LmsSourcesEnum.LEARNDASH.name())){
           Map<String,Object>response =  workflowTriggerService.handleTriggerEvents(WorkflowTriggerEvent.GENERATE_ADMIN_LOGIN_URL_FOR_LEARNER_PORTAL.name(),LmsSourcesEnum.LEARNDASH.name(),instituteId, Map.of("user",userWithJwtDTO.getUser()));
           if (response.get("adminLoginUrl") != null){
            return LearnerPortalAccessResponse.builder()
                .redirectUrl(response.get("adminLoginUrl").toString())
                .build();
           }
           throw new VacademyException("User not foud on Learndash LMS");
        }


        String redirectUrl = buildRedirectUrl(institute, userWithJwtDTO);

        return LearnerPortalAccessResponse.builder()
            .redirectUrl(redirectUrl)
            .build();
    }

    private String determineActiveLms(Institute institute) {
        try {
            Object settingData = instituteSettingService.getSettingData(institute, "LMS_SETTING");
            if (settingData == null) {
                return LmsSourcesEnum.VACADEMY.name();
            }

            ObjectMapper mapper = new ObjectMapper();
            JsonNode lmsData = mapper.convertValue(settingData, JsonNode.class);
            JsonNode innerDataNode = lmsData.get("data");

            if (innerDataNode != null && innerDataNode.has("activeLms") && !innerDataNode.get("activeLms").isNull()) {
                // 3. Return the text value from the 'activeLms' field
                return innerDataNode.get("activeLms").asText();
            }
            return LmsSourcesEnum.VACADEMY.name();
        } catch (Exception e) {
            log.warn("Error reading LMS_SETTING for institute {}: {}", institute.getId(), e.getMessage());
            return LmsSourcesEnum.VACADEMY.name();
        }
    }

    private String buildRedirectUrl(Institute institute, UserWithJwtDTO userWithJwtDTO) {
        Optional<InstituteDomainRouting> domainRouting = domainRoutingRepository
            .findByInstituteIdAndRole(institute.getId(), "LEARNER");

        String baseUrl;
        if (StringUtils.hasText(institute.getLearnerPortalBaseUrl())){
            baseUrl = "https://" + institute.getLearnerPortalBaseUrl() + "/login";
        }else{
            baseUrl = defaultLearnerPortalUrl;
        }

        return String.format("%s/login?sso=true&accessToken=%s&refreshToken=%s&instituteId=%s",
            baseUrl,
            userWithJwtDTO.getAccessToken(),
            userWithJwtDTO.getRefreshToken(),
            institute.getId());
    }

    private String buildBaseUrl(String domain, String subdomain) {
        if ("*".equals(subdomain)) {
            return "https://" + domain;
        } else {
            return "https://" + subdomain + "." + domain;
        }
    }

    public Boolean sendCredForLMS(String instituteId, String userId) {
        Institute institute = instituteRepository.findById(instituteId)
            .orElseThrow(() -> new VacademyException("Institute not found"));

        String activeLms = determineActiveLms(institute);
        UserDTO userDTO = authService.getUsersFromAuthServiceByUserIds(List.of(userId)).get(0);
        if (activeLms.equalsIgnoreCase(LmsSourcesEnum.LEARNDASH.name())){
            Map<String,Object>response =  workflowTriggerService.handleTriggerEvents(WorkflowTriggerEvent.SEND_LEARNER_CREDENTIALS.name(),LmsSourcesEnum.LEARNDASH.name(),instituteId, Map.of("user",userDTO));
            if (response.get("credSent") != null && response.get("credSent") instanceof Boolean && (Boolean) response.get("credSent")){
                return true;
            }
            return false;
        }


        authService.sendCredToUsers(List.of(userId));
        return true;
    }
}
