package vacademy.io.auth_service.feature.demo.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.demo.entity.InstituteTrial;
import vacademy.io.auth_service.feature.demo.repository.InstituteTrialRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;
import java.util.Optional;

/**
 * Stops an expired demo workspace from being logged into.
 *
 * Deliberately checked on the auth path rather than by a scheduled job: a cron can miss, double-fire
 * or fan out across replicas, whereas this cannot drift and makes extending a trial take effect on
 * the next login attempt. Institutes with no trial row — every real customer — are unaffected.
 */
@Component
@Slf4j
public class TrialAccessGuard {

    @Autowired
    private InstituteTrialRepository trialRepository;

    /** @throws VacademyException with 403 when the institute is a demo whose trial has lapsed. */
    public void assertNotExpired(String instituteId) {
        if (!StringUtils.hasText(instituteId)) {
            return;
        }
        Optional<InstituteTrial> trial = trialRepository.findById(instituteId);
        if (trial.isEmpty()) {
            return;
        }
        Date expiresAt = trial.get().getExpiresAt();
        if (expiresAt != null && expiresAt.before(new Date())) {
            log.info("Refused login to expired demo institute {} (expired {})", instituteId, expiresAt);
            throw new VacademyException(HttpStatus.FORBIDDEN,
                    "This demo workspace has ended. Get in touch and we'll set you up properly.");
        }
    }
}
