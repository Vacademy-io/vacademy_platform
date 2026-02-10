package vacademy.io.admin_core_service.features.domain_routing.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.domain_routing.dto.DomainRoutingResolveResponse;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.institute.entity.Institute;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DomainRoutingService {

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
                .allowUsernamePasswordAuth(mapping.getAllowUsernamePasswordAuth())
                .playStoreAppLink(mapping.getPlayStoreAppLink())
                .appStoreAppLink(mapping.getAppStoreAppLink())
                .windowsAppLink(mapping.getWindowsAppLink())
                .macAppLink(mapping.getMacAppLink())
                .convertUsernamePasswordToLowercase(mapping.isConvertUsernamePasswordToLowercase());

        if (institute != null) {
            responseBuilder.instituteId(institute.getId())
                    .instituteName(institute.getInstituteName())
                    .instituteLogoFileId(institute.getLogoFileId())
                    .instituteThemeCode(institute.getInstituteThemeCode())
                    .learnerPortalUrl(institute.getLearnerPortalBaseUrl())
                    .instructorPortalUrl(institute.getAdminPortalBaseUrl());
        }

        return Optional.of(responseBuilder.build());
    }
}
