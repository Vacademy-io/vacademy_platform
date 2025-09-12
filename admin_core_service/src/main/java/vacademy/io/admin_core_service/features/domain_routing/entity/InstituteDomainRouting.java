package vacademy.io.admin_core_service.features.domain_routing.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "institute_domain_routing")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstituteDomainRouting {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "domain", nullable = false)
    private String domain;

    @Column(name = "subdomain", nullable = false)
    private String subdomain;

    // Role name such as ADMIN, TEACHER, LEARNER
    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "redirect")
    private String redirect;

    @Column(name = "privacy_policy_url", length = 500)
    private String privacyPolicyUrl;
    
    @Column(name = "after_login_route")
    private String afterLoginRoute;

    @Column(name = "terms_and_condition_url", length = 500)
    private String termsAndConditionUrl;

    @Column(name = "theme")
    private String theme;

    @Column(name = "tab_text")
    private String tabText;

    @Column(name = "allow_signup")
    private Boolean allowSignup;

    @Column(name = "tab_icon_file_id")
    private String tabIconFileId;

    @Column(name = "font_family")
    private String fontFamily;

    @Column(name = "allow_google_auth")
    private Boolean allowGoogleAuth;

    @Column(name = "allow_github_auth")
    private Boolean allowGithubAuth;

    @Column(name = "allow_email_otp_auth")
    private Boolean allowEmailOtpAuth;

    @Column(name = "allow_username_password_auth")
    private Boolean allowUsernamePasswordAuth;
}


