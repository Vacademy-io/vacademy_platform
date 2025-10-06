package vacademy.io.admin_core_service.features.learner.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.domain_routing.entity.InstituteDomainRouting;
import vacademy.io.admin_core_service.features.domain_routing.repository.InstituteDomainRoutingRepository;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.user_subscription.entity.CouponCode;
import vacademy.io.admin_core_service.features.user_subscription.service.CouponCodeService;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class LearnerInvitationLinkService {

    private final InstituteDomainRoutingRepository domainRoutingRepository;
    private final CouponCodeService couponCodeService;

    public String generateLearnerInvitationResponseLink(String instituteId, EnrollInvite enrollInvite, String userId) {
        try {
            // Get the domain routing for the institute with LEARNER role
            Optional<InstituteDomainRouting> domainRouting = domainRoutingRepository
                    .findByInstituteIdAndRole(instituteId, "LEARNER");

            if (domainRouting.isEmpty()) {
                log.warn("No domain routing found for institute {} with LEARNER role", instituteId);
                return generateDefaultLink(instituteId, enrollInvite, userId);
            }

            InstituteDomainRouting routing = domainRouting.get();
            String domain = routing.getDomain();
            String subdomain = routing.getSubdomain();

            // Build the base URL using the domain routing
            String baseUrl = buildBaseUrl(domain, subdomain);
            
            // Get invite code from enroll invite
            String inviteCode = enrollInvite != null ? enrollInvite.getInviteCode() : "";
            
            // Get ref code from user's coupon
            String ref = getRefFromUserCoupon(userId);
            
            // Build the complete link
            return String.format("%s/learner-invitation-response?instituteId=%s&inviteCode=%s&ref=%s",
                    baseUrl, instituteId, inviteCode, ref);

        } catch (Exception e) {
            log.error("Error generating learner invitation response link for institute {}: {}", 
                    instituteId, e.getMessage(), e);
            return generateDefaultLink(instituteId, enrollInvite, userId);
        }
    }

    private String buildBaseUrl(String domain, String subdomain) {
        if ("*".equals(subdomain)) {
            return "https://" + domain;
        } else {
            return "https://" + subdomain + "." + domain;
        }
    }

    public String getRefFromUserCoupon(String userId) {
        try {
            Optional<CouponCode> couponCode = couponCodeService.getCouponCodeBySource(userId, "USER");
            return couponCode.map(CouponCode::getCode).orElse("xyz");
        } catch (Exception e) {
            log.warn("Error getting ref code for user {}: {}", userId, e.getMessage());
            return "xyz"; // Default fallback
        }
    }

    private String generateDefaultLink(String instituteId, EnrollInvite enrollInvite, String userId) {
        String learnerBaseUrl = "https://learner.vacademy.io"; // Local variable
        String inviteCode = enrollInvite != null ? enrollInvite.getInviteCode() : "";
        String ref = getRefFromUserCoupon(userId);
        
        return String.format("%s/learner-invitation-response?instituteId=%s&inviteCode=%s&ref=%s",
                learnerBaseUrl, instituteId, inviteCode, ref);
    }
}

