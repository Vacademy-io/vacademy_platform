package vacademy.io.common.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.auth.entity.OAuth2VendorToUserDetail;
import vacademy.io.common.auth.repository.OAuth2VendorToUserDetailRepository;

import java.util.Objects;
import java.util.Optional;

@Service
public class OAuth2VendorToUserDetailService {

    private static final Logger log = LoggerFactory.getLogger(OAuth2VendorToUserDetailService.class);

    @Autowired
    private OAuth2VendorToUserDetailRepository oauth2VendorToUserDetailRepository;

    public void saveOrUpdateOAuth2VendorToUserDetail(String vendorId, String emailId, String vendorToUserId) {
        log.info("Saving or updating OAuth2 vendor-to-user detail: '" +
                "'" +
                "vendorId={}, subject={}, emailId={}", vendorId, vendorToUserId, emailId);

        Optional<OAuth2VendorToUserDetail> optionalOAuth2VendorToUserDetail =
                oauth2VendorToUserDetailRepository.findByProviderIdAndSubject(vendorId, vendorToUserId);

        OAuth2VendorToUserDetail oAuth2VendorToUserDetail = optionalOAuth2VendorToUserDetail.orElseGet(() -> {
            log.info("No existing record found. Creating new OAuth2VendorToUserDetail.");
            return new OAuth2VendorToUserDetail();
        });

        oAuth2VendorToUserDetail.setProviderId(vendorId);
        oAuth2VendorToUserDetail.setSubject(vendorToUserId);
        if (Objects.nonNull(emailId)) {
            oAuth2VendorToUserDetail.setEmailId(emailId);
        }

        oauth2VendorToUserDetailRepository.save(oAuth2VendorToUserDetail);
        log.info("Saved OAuth2VendorToUserDetail with ID={}", oAuth2VendorToUserDetail.getId());
    }

    public String getEmailByProviderIdAndSubject(String providerId, String subject) {
        log.info("Fetching email by providerId={} and subject={}", providerId, subject);

        Optional<OAuth2VendorToUserDetail> optionalOAuth2VendorToUserDetail =
                oauth2VendorToUserDetailRepository.findByProviderIdAndSubject(providerId, subject);

        if (optionalOAuth2VendorToUserDetail.isPresent()) {
            String email = optionalOAuth2VendorToUserDetail.get().getEmailId();
            log.info("Found email: {}", email);
            return email;
        } else {
            log.warn("No record found for providerId={} and subject={}", providerId, subject);
            return null;
        }
    }

    public void verifyEmail(String subjectId,String vendorId,String emailId) {
        if (StringUtils.hasText(subjectId) && StringUtils.hasText(vendorId) && StringUtils.hasText(emailId)) {
            Optional<OAuth2VendorToUserDetail> optionalOAuth2VendorToUserDetail =
                    oauth2VendorToUserDetailRepository.findByProviderIdAndSubject(vendorId, subjectId);

            if (optionalOAuth2VendorToUserDetail.isPresent()) {
                OAuth2VendorToUserDetail oAuth2VendorToUserDetail = optionalOAuth2VendorToUserDetail.get();
                oAuth2VendorToUserDetail.setEmailId(emailId);
                oauth2VendorToUserDetailRepository.save(oAuth2VendorToUserDetail);
            }
        }
    }
}


