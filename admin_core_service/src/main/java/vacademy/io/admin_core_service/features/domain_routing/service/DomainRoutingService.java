package vacademy.io.admin_core_service.features.domain_routing.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.domain_routing.dto.DomainRoutingResolveResponse;
import vacademy.io.admin_core_service.features.domain_routing.dto.NamingOverridesDto;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.institute.enums.SettingKeyEnums;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.institute.entity.Institute;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DomainRoutingService {

    private static final ObjectMapper NAMING_OBJECT_MAPPER = new ObjectMapper();

    private final InstituteDomainRoutingRepository routingRepository;
    private final InstituteRepository instituteRepository;

    public Optional<DomainRoutingResolveResponse> resolve(String domain, String subdomain) {
        if (!StringUtils.hasText(domain) || !StringUtils.hasText(subdomain)) {
            return Optional.empty();
        }

        Optional<InstituteDomainRouting> mappingOpt = routingRepository.resolveMapping(domain.trim(), subdomain.trim());
        if (mappingOpt.isEmpty()) {
            return Optional.empty();
        }

        InstituteDomainRouting mapping = mappingOpt.get();
        Institute institute = null;

        if (StringUtils.hasText(mapping.getInstituteId())) {
            Optional<Institute> instituteOpt = instituteRepository.findById(mapping.getInstituteId());
            if (instituteOpt.isEmpty()) {
                return Optional.empty();
            }
            institute = instituteOpt.get();
        }

        DomainRoutingResolveResponse.DomainRoutingResolveResponseBuilder responseBuilder = DomainRoutingResolveResponse
                .builder()
                .role(mapping.getRole())
                .redirect(mapping.getRedirect())
                .privacyPolicyUrl(mapping.getPrivacyPolicyUrl())
                .afterLoginRoute(mapping.getAfterLoginRoute())
                .adminPortalAfterLogoutRoute(mapping.getAdminPortalAfterLogoutRoute())
                .homeIconClickRoute(mapping.getHomeIconClickRoute())
                .termsAndConditionUrl(mapping.getTermsAndConditionUrl())
                .theme(mapping.getTheme())
                .tabText(mapping.getTabText())
                .allowSignup(mapping.getAllowSignup())
                .tabIconFileId(mapping.getTabIconFileId())
                .fontFamily(mapping.getFontFamily())
                .allowGoogleAuth(mapping.getAllowGoogleAuth())
                .allowGithubAuth(mapping.getAllowGithubAuth())
                .allowEmailOtpAuth(mapping.getAllowEmailOtpAuth())
                .allowPhoneAuth(mapping.getAllowPhoneAuth())
                .allowUsernamePasswordAuth(mapping.getAllowUsernamePasswordAuth())
                .playStoreAppLink(mapping.getPlayStoreAppLink())
                .appStoreAppLink(mapping.getAppStoreAppLink())
                .windowsAppLink(mapping.getWindowsAppLink())
                .macAppLink(mapping.getMacAppLink())
                .convertUsernamePasswordToLowercase(mapping.isConvertUsernamePasswordToLowercase())
                .commaSeparatedPreferredCountry(mapping.getCommaSeparatedPreferredCountry())
                .hideInstituteName(mapping.getHideInstituteName())
                .logoWidthPx(mapping.getLogoWidthPx())
                .logoHeightPx(mapping.getLogoHeightPx());

        if (institute != null) {
            responseBuilder.instituteId(institute.getId())
                    .instituteName(institute.getInstituteName())
                    .instituteLogoFileId(institute.getLogoFileId())
                    .instituteThemeCode(institute.getInstituteThemeCode())
                    .learnerPortalUrl(institute.getLearnerPortalBaseUrl())
                    .instructorPortalUrl(institute.getAdminPortalBaseUrl());

            NamingOverridesDto namingOverrides = extractNamingOverrides(institute.getSetting());
            if (namingOverrides != null) {
                responseBuilder.namingOverrides(namingOverrides);
            }
        }

        // If sub-org is configured, override logo, name, and theme from sub-org institute
        if (StringUtils.hasText(mapping.getSubOrgId())) {
            responseBuilder.subOrgId(mapping.getSubOrgId());
            instituteRepository.findById(mapping.getSubOrgId()).ifPresent(subOrg -> {
                if (StringUtils.hasText(subOrg.getLogoFileId())) {
                    responseBuilder.instituteLogoFileId(subOrg.getLogoFileId());
                }
                if (StringUtils.hasText(subOrg.getInstituteName())) {
                    responseBuilder.instituteName(subOrg.getInstituteName());
                }
                if (StringUtils.hasText(subOrg.getInstituteThemeCode())) {
                    responseBuilder.instituteThemeCode(subOrg.getInstituteThemeCode());
                }
            });
        }

        return Optional.of(responseBuilder.build());
    }

    private NamingOverridesDto extractNamingOverrides(String settingJson) {
        if (!StringUtils.hasText(settingJson)) {
            return null;
        }
        try {
            JsonNode root = NAMING_OBJECT_MAPPER.readTree(settingJson);
            JsonNode entries = root.path("setting")
                    .path(SettingKeyEnums.NAMING_SETTING.name())
                    .path("data")
                    .path("data");
            if (!entries.isArray() || entries.isEmpty()) {
                return null;
            }

            String course = null;
            String coursePlural = null;
            for (JsonNode entry : entries) {
                String key = entry.path("key").asText(null);
                String customValue = entry.path("customValue").asText(null);
                if (!StringUtils.hasText(key) || !StringUtils.hasText(customValue)) {
                    continue;
                }
                if ("Course".equals(key)) {
                    course = customValue;
                } else if ("Course_plural".equals(key)) {
                    coursePlural = customValue;
                }
            }

            if (course == null && coursePlural == null) {
                return null;
            }
            return NamingOverridesDto.builder()
                    .course(course)
                    .coursePlural(coursePlural)
                    .build();
        } catch (Exception e) {
            log.warn("Failed to parse NAMING_SETTING for domain routing response", e);
            return null;
        }
    }
}
