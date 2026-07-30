package vacademy.io.auth_service.feature.demo.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.auth.dto.RegisterRequest;
import vacademy.io.auth_service.feature.auth.manager.AuthManager;
import vacademy.io.auth_service.feature.demo.dto.DemoProvisionRequest;
import vacademy.io.auth_service.feature.demo.dto.DemoProvisionResponse;
import vacademy.io.auth_service.feature.demo.entity.InstituteTrial;
import vacademy.io.auth_service.feature.demo.repository.InstituteTrialRepository;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * Turns an accepted quote into a live, time-boxed demo workspace.
 *
 * Runs in auth_service because this is where institute creation is already orchestrated — it calls
 * admin_core over HMAC to mint the institute, then creates the root admin locally. Doing it from
 * admin_core would mean inventing a second admin_core → auth path for user creation.
 */
@Service
@Slf4j
public class DemoProvisionService {

    private static final String FREE_TRIAL = "FREE_TRIAL";

    @Autowired
    private AuthManager authManager;
    @Autowired
    private InstituteTrialRepository trialRepository;
    @Autowired
    private UserRepository userRepository;

    @Value("${ONBOARDING_ADMIN_PORTAL_URL:https://dash.vacademy.io}")
    private String adminPortalUrl;

    @Transactional
    public DemoProvisionResponse provision(DemoProvisionRequest req, String actingUserId) {
        validate(req);
        Timestamp expiresAt = parseExpiry(req.getExpiresAt());

        // A duplicate username would otherwise surface as a raw constraint violation.
        if (userRepository.findByUsername(req.getAdminUsername().trim()).isPresent()) {
            throw new VacademyException(HttpStatus.CONFLICT,
                    "Username '" + req.getAdminUsername().trim() + "' is taken — pick another.");
        }

        InstituteInfoDTO institute = new InstituteInfoDTO();
        institute.setInstituteName(req.getInstituteName().trim());
        institute.setType(emptyToNull(req.getInstituteType()));
        institute.setEmail(req.getAdminEmail().trim());
        institute.setPhone(emptyToNull(req.getAdminPhone()));
        // What makes this a demo rather than a customer.
        institute.setLeadTag(FREE_TRIAL);
        institute.setDemoExpiresAt(expiresAt);
        institute.setSourceQuoteId(emptyToNull(req.getQuoteId()));

        RegisterRequest register = new RegisterRequest();
        register.setFullName(req.getAdminFullName().trim());
        register.setUserName(req.getAdminUsername().trim());
        register.setEmail(req.getAdminEmail().trim());
        register.setPassword(req.getAdminPassword());
        register.setUserRoles(List.of("ADMIN"));
        register.setInstitute(institute);

        // Creates the institute in admin_core, then the root admin here, and sends the welcome mail.
        authManager.registerRootUser(register);

        String instituteId = institute.getId();
        if (!StringUtils.hasText(instituteId)) {
            throw new VacademyException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "Institute was created but no id came back — cannot record the trial expiry.");
        }

        // auth_service can't read institutes (separate database), so the expiry it enforces at
        // login lives here. institutes.demo_expires_at is the reporting copy.
        trialRepository.save(InstituteTrial.builder()
                .instituteId(instituteId)
                .expiresAt(expiresAt)
                .sourceQuoteId(emptyToNull(req.getQuoteId()))
                .createdBy(actingUserId)
                .build());

        log.info("Provisioned demo institute {} ('{}') from quote {}, expires {}",
                instituteId, institute.getInstituteName(), req.getQuoteId(), expiresAt);

        return DemoProvisionResponse.builder()
                .instituteId(instituteId)
                .instituteName(institute.getInstituteName())
                .adminUsername(register.getUserName())
                .expiresAt(expiresAt)
                .adminPortalUrl(adminPortalUrl)
                .build();
    }

    /** Moves a trial's end date. Both copies of the expiry are updated together. */
    @Transactional
    public InstituteTrial extend(String instituteId, String newExpiry) {
        InstituteTrial trial = trialRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "No trial for that institute"));
        trial.setExpiresAt(parseExpiry(newExpiry));
        return trialRepository.save(trial);
    }

    private void validate(DemoProvisionRequest r) {
        require(r.getInstituteName(), "Institute name");
        require(r.getAdminFullName(), "Admin name");
        require(r.getAdminEmail(), "Admin email");
        require(r.getAdminUsername(), "Username");
        require(r.getAdminPassword(), "Password");
        require(r.getExpiresAt(), "Expiry date");
    }

    private static void require(String value, String label) {
        if (!StringUtils.hasText(value)) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, label + " is required");
        }
    }

    private static Timestamp parseExpiry(String raw) {
        LocalDateTime when;
        try {
            // Accept both a bare date and a full timestamp; a bare date means end of that day.
            when = raw.length() <= 10
                    ? LocalDateTime.parse(raw + "T23:59:59")
                    : LocalDateTime.parse(raw);
        } catch (DateTimeParseException e) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Couldn't read the expiry date: " + raw);
        }
        if (when.isBefore(LocalDateTime.now())) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "The expiry date is in the past");
        }
        return Timestamp.valueOf(when);
    }

    private static String emptyToNull(String v) {
        return StringUtils.hasText(v) ? v.trim() : null;
    }
}
