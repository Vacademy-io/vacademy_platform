package vacademy.io.admin_core_service.features.domain_routing.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.domain_routing.dto.DomainRoutingUpsertRequest;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DomainRoutingAdminService {

    private final InstituteDomainRoutingRepository repository;

    public InstituteDomainRouting create(DomainRoutingUpsertRequest request) {
        validate(request);
        InstituteDomainRouting entity = InstituteDomainRouting.builder()
                .domain(request.getDomain().trim())
                .subdomain(request.getSubdomain().trim())
                .role(request.getRole().trim())
                .instituteId(request.getInstituteId().trim())
                .redirect(request.getRedirect() == null ? null : request.getRedirect().trim())
                .privacyPolicyUrl(request.getPrivacyPolicyUrl() == null ? null : request.getPrivacyPolicyUrl().trim())
                .afterLoginRoute(request.getAfterLoginRoute() == null ? null : request.getAfterLoginRoute().trim())
                .adminPortalAfterLogoutRoute(request.getAdminPortalAfterLogoutRoute() == null ? null
                        : request.getAdminPortalAfterLogoutRoute().trim())
                .homeIconClickRoute(
                        request.getHomeIconClickRoute() == null ? null : request.getHomeIconClickRoute().trim())
                .termsAndConditionUrl(
                        request.getTermsAndConditionUrl() == null ? null : request.getTermsAndConditionUrl().trim())
                .theme(request.getTheme() == null ? null : request.getTheme().trim())
                .tabText(request.getTabText() == null ? null : request.getTabText().trim())
                .allowSignup(request.getAllowSignup())
                .tabIconFileId(request.getTabIconFileId() == null ? null : request.getTabIconFileId().trim())
                .fontFamily(request.getFontFamily() == null ? null : request.getFontFamily().trim())
                .allowGoogleAuth(request.getAllowGoogleAuth())
                .allowGithubAuth(request.getAllowGithubAuth())
                .allowEmailOtpAuth(request.getAllowEmailOtpAuth())
                .allowUsernamePasswordAuth(request.getAllowUsernamePasswordAuth())
                .playStoreAppLink(request.getPlayStoreAppLink() == null ? null : request.getPlayStoreAppLink().trim())
                .appStoreAppLink(request.getAppStoreAppLink() == null ? null : request.getAppStoreAppLink().trim())
                .windowsAppLink(request.getWindowsAppLink() == null ? null : request.getWindowsAppLink().trim())
                .macAppLink(request.getMacAppLink() == null ? null : request.getMacAppLink().trim())
                .convertUsernamePasswordToLowercase(request.getConvertUsernamePasswordToLowercase() != null ? request.getConvertUsernamePasswordToLowercase() : false)
                .build();
        return repository.save(entity);
    }

    public Optional<InstituteDomainRouting> get(String id) {
        return repository.findById(id);
    }

    public Optional<InstituteDomainRouting> update(String id, DomainRoutingUpsertRequest request) {
        validate(request);
        return repository.findById(id).map(existing -> {
            existing.setDomain(request.getDomain().trim());
            existing.setSubdomain(request.getSubdomain().trim());
            existing.setRole(request.getRole().trim());
            existing.setInstituteId(request.getInstituteId().trim());
            existing.setAfterLoginRoute(
                    request.getAfterLoginRoute() == null ? null : request.getAfterLoginRoute().trim());
            existing.setAdminPortalAfterLogoutRoute(request.getAdminPortalAfterLogoutRoute() == null ? null
                    : request.getAdminPortalAfterLogoutRoute().trim());
            existing.setHomeIconClickRoute(
                    request.getHomeIconClickRoute() == null ? null : request.getHomeIconClickRoute().trim());
            existing.setRedirect(request.getRedirect() == null ? null : request.getRedirect().trim());
            existing.setPrivacyPolicyUrl(
                    request.getPrivacyPolicyUrl() == null ? null : request.getPrivacyPolicyUrl().trim());
            existing.setTermsAndConditionUrl(
                    request.getTermsAndConditionUrl() == null ? null : request.getTermsAndConditionUrl().trim());
            existing.setTheme(request.getTheme() == null ? null : request.getTheme().trim());
            existing.setTabText(request.getTabText() == null ? null : request.getTabText().trim());
            existing.setAllowSignup(request.getAllowSignup());
            existing.setTabIconFileId(request.getTabIconFileId() == null ? null : request.getTabIconFileId().trim());
            existing.setFontFamily(request.getFontFamily() == null ? null : request.getFontFamily().trim());
            existing.setAllowGoogleAuth(request.getAllowGoogleAuth());
            existing.setAllowGithubAuth(request.getAllowGithubAuth());
            existing.setAllowEmailOtpAuth(request.getAllowEmailOtpAuth());
            existing.setAllowUsernamePasswordAuth(request.getAllowUsernamePasswordAuth());
            existing.setPlayStoreAppLink(
                    request.getPlayStoreAppLink() == null ? null : request.getPlayStoreAppLink().trim());
            existing.setAppStoreAppLink(
                    request.getAppStoreAppLink() == null ? null : request.getAppStoreAppLink().trim());
            existing.setWindowsAppLink(request.getWindowsAppLink() == null ? null : request.getWindowsAppLink().trim());
            existing.setMacAppLink(request.getMacAppLink() == null ? null : request.getMacAppLink().trim());
            existing.setConvertUsernamePasswordToLowercase(request.getConvertUsernamePasswordToLowercase() != null ? request.getConvertUsernamePasswordToLowercase() : false);
            return repository.save(existing);
        });
    }

    public void delete(String id) {
        repository.deleteById(id);
    }

    private void validate(DomainRoutingUpsertRequest request) {
        if (!StringUtils.hasText(request.getDomain()) || !StringUtils.hasText(request.getSubdomain())
                || !StringUtils.hasText(request.getRole()) || !StringUtils.hasText(request.getInstituteId())) {
            throw new IllegalArgumentException("All fields domain, subdomain, role, instituteId are required");
        }
    }
}
