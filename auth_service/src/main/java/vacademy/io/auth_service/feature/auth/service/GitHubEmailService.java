package vacademy.io.auth_service.feature.auth.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Optional;

@Service
public class GitHubEmailService {

    private static final Logger log = LoggerFactory.getLogger(GitHubEmailService.class);
    private static final String GITHUB_EMAILS_API_URL = "https://api.github.com/user/emails";

    @Autowired
    @Lazy
    private RestTemplate restTemplate;

    @Autowired
    @Lazy
    private OAuth2TokenService oAuth2TokenService;

    /**
     * Fetches all email addresses associated with a GitHub account
     * @param oauthToken OAuth2 authentication token
     * @return List of GitHub email objects
     */
    public List<GitHubEmail> fetchAllGitHubEmails(OAuth2AuthenticationToken oauthToken) {
        try {
            // Get the access token from the OAuth2 token
            String accessToken = oAuth2TokenService.getAccessToken(oauthToken);
            
            if (accessToken == null) {
                log.warn("No access token available for GitHub API call");
                return List.of();
            }
            
            log.info("Fetching GitHub emails for user: {}", oauthToken.getName());
            
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + accessToken);
            headers.set("Accept", "application/vnd.github.v3+json");
            
            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<GitHubEmail[]> response = restTemplate.exchange(
                GITHUB_EMAILS_API_URL,
                HttpMethod.GET,
                entity,
                GitHubEmail[].class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                List<GitHubEmail> emails = List.of(response.getBody());
                log.info("Successfully fetched {} GitHub emails", emails.size());
                return emails;
            } else {
                log.warn("Failed to fetch GitHub emails. Status: {}", response.getStatusCode());
                return List.of();
            }
            
        } catch (Exception e) {
            log.error("Error fetching GitHub emails", e);
            return List.of();
        }
    }

    /**
     * Selects the best email from multiple GitHub emails
     * Priority: Primary verified email > First verified email > Primary email > First email
     * @param emails List of GitHub emails
     * @return Best email address or null if none found
     */
    public String selectBestEmail(List<GitHubEmail> emails) {
        if (emails == null || emails.isEmpty()) {
            return null;
        }

        // 1. Try to find primary verified email
        Optional<GitHubEmail> primaryVerified = emails.stream()
            .filter(email -> email.isPrimary() && email.isVerified())
            .findFirst();
        
        if (primaryVerified.isPresent()) {
            log.info("Selected primary verified email: {}", primaryVerified.get().getEmail());
            return primaryVerified.get().getEmail();
        }

        // 2. Try to find any verified email
        Optional<GitHubEmail> verified = emails.stream()
            .filter(GitHubEmail::isVerified)
            .findFirst();
        
        if (verified.isPresent()) {
            log.info("Selected first verified email: {}", verified.get().getEmail());
            return verified.get().getEmail();
        }

        // 3. Try to find primary email (even if not verified)
        Optional<GitHubEmail> primary = emails.stream()
            .filter(GitHubEmail::isPrimary)
            .findFirst();
        
        if (primary.isPresent()) {
            log.info("Selected primary email: {}", primary.get().getEmail());
            return primary.get().getEmail();
        }

        // 4. Fallback to first email
        GitHubEmail firstEmail = emails.get(0);
        log.info("Selected first available email: {}", firstEmail.getEmail());
        return firstEmail.getEmail();
    }

    /**
     * Gets all verified emails from the list
     * @param emails List of GitHub emails
     * @return List of verified email addresses
     */
    public List<String> getVerifiedEmails(List<GitHubEmail> emails) {
        if (emails == null || emails.isEmpty()) {
            return List.of();
        }

        return emails.stream()
            .filter(GitHubEmail::isVerified)
            .map(GitHubEmail::getEmail)
            .toList();
    }


    /**
     * GitHub email data structure
     */
    public static class GitHubEmail {
        @JsonProperty("email")
        private String email;
        
        @JsonProperty("primary")
        private boolean primary;
        
        @JsonProperty("verified")
        private boolean verified;
        
        @JsonProperty("visibility")
        private String visibility;

        // Constructors
        public GitHubEmail() {}

        public GitHubEmail(String email, boolean primary, boolean verified, String visibility) {
            this.email = email;
            this.primary = primary;
            this.verified = verified;
            this.visibility = visibility;
        }

        // Getters and setters
        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public boolean isPrimary() {
            return primary;
        }

        public void setPrimary(boolean primary) {
            this.primary = primary;
        }

        public boolean isVerified() {
            return verified;
        }

        public void setVerified(boolean verified) {
            this.verified = verified;
        }

        public String getVisibility() {
            return visibility;
        }

        public void setVisibility(String visibility) {
            this.visibility = visibility;
        }

        @Override
        public String toString() {
            return "GitHubEmail{" +
                    "email='" + email + '\'' +
                    ", primary=" + primary +
                    ", verified=" + verified +
                    ", visibility='" + visibility + '\'' +
                    '}';
        }
    }
}
