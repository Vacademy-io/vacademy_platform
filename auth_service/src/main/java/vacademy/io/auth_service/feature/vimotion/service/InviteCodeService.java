package vacademy.io.auth_service.feature.vimotion.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.vimotion.entity.InviteCode;
import vacademy.io.auth_service.feature.vimotion.entity.InviteRedemption;
import vacademy.io.auth_service.feature.vimotion.repository.InviteCodeRepository;
import vacademy.io.auth_service.feature.vimotion.repository.InviteRedemptionRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.security.SecureRandom;
import java.util.Date;
import java.util.List;

@Service
public class InviteCodeService {

    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_BODY_LENGTH = 6;
    private static final String CODE_PREFIX = "VIM-";

    private final SecureRandom random = new SecureRandom();

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

    /* ============================================================
     * Admin / management surface (called from the admin tool only)
     * ============================================================ */

    @Transactional
    public InviteCode createOpen(Integer maxUses,
                                 Date expiresAt,
                                 String note,
                                 String createdBy) {
        InviteCode code = InviteCode.builder()
                .code(generateUniqueCode())
                .kind(InviteCode.KIND_OPEN)
                .status(InviteCode.STATUS_ACTIVE)
                .maxUses(maxUses)
                .usedCount(0)
                .expiresAt(expiresAt)
                .note(note)
                .createdBy(createdBy)
                .build();
        return inviteCodeRepository.save(code);
    }

    @Transactional
    public InviteCode createLocked(String email,
                                   String phoneNumber,
                                   String waitlistId,
                                   Date expiresAt,
                                   String note,
                                   String createdBy) {
        if (!StringUtils.hasText(email)) {
            throw new VacademyException("Locked email is required");
        }
        if (!StringUtils.hasText(phoneNumber)) {
            throw new VacademyException("Locked phone is required");
        }
        InviteCode code = InviteCode.builder()
                .code(generateUniqueCode())
                .kind(InviteCode.KIND_LOCKED)
                .status(InviteCode.STATUS_ACTIVE)
                .lockedEmail(email)
                .lockedPhoneNumber(phoneNumber)
                .waitlistId(waitlistId)
                .usedCount(0)
                .expiresAt(expiresAt)
                .note(note)
                .createdBy(createdBy)
                .build();
        return inviteCodeRepository.save(code);
    }

    @Transactional
    public InviteCode revoke(String inviteCodeId) {
        InviteCode code = inviteCodeRepository.findById(inviteCodeId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Invite code not found"));
        if (InviteCode.STATUS_REVOKED.equals(code.getStatus())) {
            return code;
        }
        code.setStatus(InviteCode.STATUS_REVOKED);
        return inviteCodeRepository.save(code);
    }

    public Page<InviteCode> list(String kind, String status, Pageable pageable) {
        Pageable sorted = pageable.getSort().isUnsorted()
                ? org.springframework.data.domain.PageRequest.of(
                        pageable.getPageNumber(),
                        pageable.getPageSize(),
                        Sort.by(Sort.Direction.DESC, "createdAt"))
                : pageable;
        if (StringUtils.hasText(kind) && StringUtils.hasText(status)) {
            return inviteCodeRepository.findByKindAndStatus(kind, status, sorted);
        }
        if (StringUtils.hasText(kind)) {
            return inviteCodeRepository.findByKind(kind, sorted);
        }
        if (StringUtils.hasText(status)) {
            return inviteCodeRepository.findByStatus(status, sorted);
        }
        return inviteCodeRepository.findAll(sorted);
    }

    public InviteCode get(String inviteCodeId) {
        return inviteCodeRepository.findById(inviteCodeId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Invite code not found"));
    }

    public List<InviteRedemption> listRedemptions(String inviteCodeId) {
        return inviteRedemptionRepository.findByInviteCodeIdOrderByRedeemedAtDesc(inviteCodeId);
    }

    /* ============================================================
     * Helpers
     * ============================================================ */

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

    private String generateUniqueCode() {
        // 8 attempts is plenty given a 32^6 keyspace (~10^9) and tiny volumes
        // — collisions are statistically negligible.
        for (int i = 0; i < 8; i++) {
            String candidate = CODE_PREFIX + randomBody();
            if (inviteCodeRepository.findByCode(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new VacademyException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Could not allocate an invite code, please retry");
    }

    private String randomBody() {
        StringBuilder sb = new StringBuilder(CODE_BODY_LENGTH);
        for (int i = 0; i < CODE_BODY_LENGTH; i++) {
            sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }
}
