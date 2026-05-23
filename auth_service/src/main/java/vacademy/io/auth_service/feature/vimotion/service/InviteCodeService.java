package vacademy.io.auth_service.feature.vimotion.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.vimotion.entity.InviteCode;
import vacademy.io.auth_service.feature.vimotion.entity.InviteRedemption;
import vacademy.io.auth_service.feature.vimotion.repository.InviteCodeRepository;
import vacademy.io.auth_service.feature.vimotion.repository.InviteRedemptionRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;

@Service
public class InviteCodeService {

    @Autowired
    private InviteCodeRepository inviteCodeRepository;

    @Autowired
    private InviteRedemptionRepository inviteRedemptionRepository;

    /**
     * Look up by the human-friendly code string and verify it's currently
     * redeemable (active, not expired, not exhausted). Throws 4xx-style
     * VacademyException on any failure — callers convert these to user-facing
     * messages.
     */
    public InviteCode validateByCode(String code) {
        if (!StringUtils.hasText(code)) {
            throw new VacademyException("Invite code is required");
        }
        InviteCode inviteCode = inviteCodeRepository.findByCode(code.trim())
                .orElseThrow(() -> new VacademyException(HttpStatus.BAD_REQUEST, "Invalid invite code"));
        ensureRedeemable(inviteCode);
        return inviteCode;
    }

    /**
     * Same checks as {@link #validateByCode(String)} but keyed by the internal
     * UUID — used when re-validating a code that was previously bound to a
     * signup token.
     */
    public InviteCode validateById(String inviteCodeId) {
        if (!StringUtils.hasText(inviteCodeId)) {
            throw new VacademyException("Invite code id is required");
        }
        InviteCode inviteCode = inviteCodeRepository.findById(inviteCodeId)
                .orElseThrow(() -> new VacademyException(HttpStatus.BAD_REQUEST, "Invalid invite code"));
        ensureRedeemable(inviteCode);
        return inviteCode;
    }

    /**
     * Atomically bumps used_count, marks the row exhausted when applicable, and
     * writes the audit row. Run in the caller's transaction so signup failures
     * after this point roll back the redemption write (though the institute
     * creation HTTP call earlier in signup will not).
     */
    @Transactional
    public void redeem(String inviteCodeId,
                       String userId,
                       String instituteId,
                       String email,
                       String phoneNumber) {
        if (!StringUtils.hasText(inviteCodeId)) {
            throw new VacademyException("Invite code id is required");
        }
        int updated = inviteCodeRepository.incrementUsage(inviteCodeId);
        if (updated == 0) {
            // Either revoked, exhausted, or expired between validate and redeem.
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Invite code is no longer valid");
        }
        InviteRedemption redemption = InviteRedemption.builder()
                .inviteCodeId(inviteCodeId)
                .email(email)
                .phoneNumber(phoneNumber)
                .userId(userId)
                .instituteId(instituteId)
                .build();
        inviteRedemptionRepository.save(redemption);
    }

    private void ensureRedeemable(InviteCode inviteCode) {
        if (!InviteCode.STATUS_ACTIVE.equals(inviteCode.getStatus())) {
            if (InviteCode.STATUS_REVOKED.equals(inviteCode.getStatus())) {
                throw new VacademyException(HttpStatus.BAD_REQUEST, "Invite code has been revoked");
            }
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Invite code is no longer available");
        }
        if (inviteCode.getExpiresAt() != null && inviteCode.getExpiresAt().before(new Date())) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Invite code has expired");
        }
        Integer maxUses = inviteCode.getMaxUses();
        Integer usedCount = inviteCode.getUsedCount();
        if (maxUses != null && usedCount != null && usedCount >= maxUses) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Invite code is no longer available");
        }
    }
}
