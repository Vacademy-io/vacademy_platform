package vacademy.io.common.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.auth.entity.OAuth2VendorToUserDetail;
import vacademy.io.common.auth.repository.OAuth2VendorToUserDetailRepository;

import java.util.*;
import java.util.stream.Collectors;

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

    /**
     * Enhanced method to handle multiple emails for OAuth2 providers (especially GitHub)
     * @param vendorId OAuth2 provider ID (e.g., "github", "google")
     * @param primaryEmail Primary email address
     * @param vendorToUserId Unique user ID from the OAuth2 provider
     * @param allEmails List of all email addresses associated with the account
     */
    public void saveOrUpdateOAuth2VendorToUserDetailWithMultipleEmails(String vendorId, String primaryEmail, 
                                                                      String vendorToUserId, List<String> allEmails) {
        log.info("Saving or updating OAuth2 vendor-to-user detail with multiple emails: " +
                "vendorId={}, subject={}, primaryEmail={}, allEmails={}", 
                vendorId, vendorToUserId, primaryEmail, allEmails);

        Optional<OAuth2VendorToUserDetail> optionalOAuth2VendorToUserDetail =
                oauth2VendorToUserDetailRepository.findByProviderIdAndSubject(vendorId, vendorToUserId);

        OAuth2VendorToUserDetail oAuth2VendorToUserDetail = optionalOAuth2VendorToUserDetail.orElseGet(() -> {
            log.info("No existing record found. Creating new OAuth2VendorToUserDetail.");
            return new OAuth2VendorToUserDetail();
        });

        oAuth2VendorToUserDetail.setProviderId(vendorId);
        oAuth2VendorToUserDetail.setSubject(vendorToUserId);
        
        // Set primary email
        if (Objects.nonNull(primaryEmail)) {
            oAuth2VendorToUserDetail.setEmailId(primaryEmail);
        }
        
        // Store additional emails in a comma-separated format in a custom field
        // Note: This assumes the entity has a field for additional emails
        // If not, you might need to create a separate table for multiple emails
        if (allEmails != null && !allEmails.isEmpty()) {
            String additionalEmails = allEmails.stream()
                    .filter(email -> !email.equals(primaryEmail))
                    .collect(Collectors.joining(","));
            
            // If the entity doesn't have this field, you can log it for now
            log.info("Additional emails for {}: {}", vendorToUserId, additionalEmails);
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

    /**
     * Gets all emails associated with a provider and subject
     * @param providerId OAuth2 provider ID
     * @param subject Unique user ID from the OAuth2 provider
     * @return List of all email addresses
     */
    public List<String> getAllEmailsByProviderIdAndSubject(String providerId, String subject) {
        log.info("Fetching all emails by providerId={} and subject={}", providerId, subject);

        Optional<OAuth2VendorToUserDetail> optionalOAuth2VendorToUserDetail =
                oauth2VendorToUserDetailRepository.findByProviderIdAndSubject(providerId, subject);

        if (optionalOAuth2VendorToUserDetail.isPresent()) {
            OAuth2VendorToUserDetail detail = optionalOAuth2VendorToUserDetail.get();
            List<String> emails = new ArrayList<>();
            
            // Add primary email
            if (StringUtils.hasText(detail.getEmailId())) {
                emails.add(detail.getEmailId());
            }
            
            // Add additional emails if stored
            // Note: This would need to be implemented based on how you store additional emails
            // For now, we'll just return the primary email
            log.info("Found {} emails for providerId={} and subject={}", emails.size(), providerId, subject);
            return emails;
        } else {
            log.warn("No record found for providerId={} and subject={}", providerId, subject);
            return List.of();
        }
    }

    /**
     * Checks if any of the provided emails match existing user accounts
     * @param emails List of email addresses to check
     * @return List of emails that match existing accounts
     */
    public List<String> findMatchingEmails(List<String> emails) {
        if (emails == null || emails.isEmpty()) {
            return List.of();
        }

        // This would need to be implemented based on your user repository
        // For now, return empty list as placeholder
        log.info("Checking {} emails for existing accounts", emails.size());
        return List.of();
    }
}


