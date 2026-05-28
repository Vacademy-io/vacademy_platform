package vacademy.io.auth_service.feature.vimotion.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.auth_service.feature.notification.service.NotificationService;
import vacademy.io.auth_service.feature.vimotion.dto.WaitlistStatusResponse;
import vacademy.io.auth_service.feature.vimotion.entity.InviteCode;
import vacademy.io.auth_service.feature.vimotion.entity.WaitlistEntry;
import vacademy.io.auth_service.feature.vimotion.repository.WaitlistRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.notification.dto.GenericEmailRequest;

import java.security.SecureRandom;
import java.util.List;
import java.util.Optional;

@Service
public class WaitlistService {

    private static final Logger log = LoggerFactory.getLogger(WaitlistService.class);

    private static final String REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int REFERRAL_BODY_LENGTH = 6;
    private static final String REFERRAL_PREFIX = "VIM-";

    // Live-counter cache: avoids hammering the DB on every page tick. 30s TTL
    // is short enough that the "you're #N" number feels live without a per-poll
    // round-trip.
    private static final long COUNT_CACHE_TTL_MS = 30_000L;

    private final SecureRandom random = new SecureRandom();

    private volatile long cachedCountAt = 0L;
    private volatile long cachedCount = 0L;

    @Autowired
    private WaitlistRepository waitlistRepository;

    @Autowired
    private InviteCodeService inviteCodeService;

    @Autowired
    private NotificationService notificationService;

    @Value("${vimotion.waitlist.bump-per-referral:5}")
    private int bumpPerReferral;

    @Value("${vimotion.platform-institute-id:}")
    private String platformInstituteId;

    @Value("${vimotion.public-app-url:https://app.vimotion.ai}")
    private String publicAppUrl;

    @Transactional
    public WaitlistStatusResponse join(String fullName,
                                       String email,
                                       String phoneNumber,
                                       String referralCode,
                                       String source) {
        if (!StringUtils.hasText(fullName)) {
            throw new VacademyException("Full name is required");
        }
        if (!StringUtils.hasText(email)) {
            throw new VacademyException("Email is required");
        }
        if (!StringUtils.hasText(phoneNumber)) {
            throw new VacademyException("Phone number is required");
        }

        String normalizedEmail = email.trim().toLowerCase();

        // Email dedupe — second sign-up returns the existing position instead
        // of erroring, so a user who's lost their referral link still sees
        // their slot.
        Optional<WaitlistEntry> existing = waitlistRepository.findByEmailIgnoreCase(normalizedEmail);
        if (existing.isPresent()) {
            return buildStatus(existing.get());
        }

        String resolvedReferrerId = null;
        if (StringUtils.hasText(referralCode)) {
            Optional<WaitlistEntry> referrer = waitlistRepository.findByReferralCode(referralCode.trim());
            if (referrer.isPresent()) {
                resolvedReferrerId = referrer.get().getId();
            }
        }

        int nextPosition = waitlistRepository.nextPosition();
        String generatedCode = generateUniqueReferralCode();

        WaitlistEntry entry = WaitlistEntry.builder()
                .fullName(fullName.trim())
                .email(normalizedEmail)
                .phoneNumber(phoneNumber.trim())
                .status(WaitlistEntry.STATUS_PENDING)
                .referrerId(resolvedReferrerId)
                .referralCode(generatedCode)
                .referralCount(0)
                .position(nextPosition)
                .source(StringUtils.hasText(source) ? source : null)
                .build();
        try {
            entry = waitlistRepository.save(entry);
        } catch (DataIntegrityViolationException ex) {
            // Concurrent submit with the same email won the race — re-read
            // and return the existing row instead of a 500. The position
            // sequence value we just pulled is left as a gap, which is fine.
            return waitlistRepository.findByEmailIgnoreCase(normalizedEmail)
                    .map(this::buildStatus)
                    .orElseThrow(() -> ex);
        }

        if (resolvedReferrerId != null) {
            waitlistRepository.incrementReferralCount(resolvedReferrerId);
        }

        // New row means the cached total is stale — force a refresh on next
        // read.
        cachedCountAt = 0L;

        return buildStatus(entry);
    }

    public WaitlistStatusResponse status(String email) {
        if (!StringUtils.hasText(email)) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Email is required");
        }
        WaitlistEntry entry = waitlistRepository.findByEmailIgnoreCase(email.trim().toLowerCase())
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "No waitlist entry for that email"));
        return buildStatus(entry);
    }

    public long totalCount() {
        long now = System.currentTimeMillis();
        if (now - cachedCountAt > COUNT_CACHE_TTL_MS) {
            cachedCount = waitlistRepository.count();
            cachedCountAt = now;
        }
        return cachedCount;
    }

    private WaitlistStatusResponse buildStatus(WaitlistEntry entry) {
        int referralCount = entry.getReferralCount() == null ? 0 : entry.getReferralCount();
        int effective = Math.max(entry.getPosition() - referralCount * bumpPerReferral, 1);
        return WaitlistStatusResponse.builder()
                .id(entry.getId())
                .fullName(entry.getFullName())
                .email(entry.getEmail())
                .status(entry.getStatus())
                .referralCode(entry.getReferralCode())
                .referralCount(referralCount)
                .position(entry.getPosition())
                .effectivePosition(effective)
                .totalCount(totalCount())
                .build();
    }

    private String generateUniqueReferralCode() {
        // 8 attempts is plenty given a 32^6 keyspace (~10^9) and tiny user
        // counts at launch — collisions are statistically negligible.
        for (int i = 0; i < 8; i++) {
            String candidate = REFERRAL_PREFIX + randomBody();
            if (waitlistRepository.findByReferralCode(candidate).isEmpty()) {
                return candidate;
            }
        }
        throw new VacademyException(HttpStatus.INTERNAL_SERVER_ERROR,
                "Could not allocate a referral code, please retry");
    }

    private String randomBody() {
        StringBuilder sb = new StringBuilder(REFERRAL_BODY_LENGTH);
        for (int i = 0; i < REFERRAL_BODY_LENGTH; i++) {
            sb.append(REFERRAL_ALPHABET.charAt(random.nextInt(REFERRAL_ALPHABET.length())));
        }
        return sb.toString();
    }

    /* ============================================================
     * Admin / management surface
     * ============================================================ */

    public Page<WaitlistEntry> list(String status, String search, Pageable pageable) {
        Pageable sorted = pageable.getSort().isUnsorted()
                ? PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
                        Sort.by(Sort.Direction.ASC, "position"))
                : pageable;
        return waitlistRepository.search(
                StringUtils.hasText(status) ? status : null,
                StringUtils.hasText(search) ? search.trim() : null,
                sorted);
    }

    public record InviteResult(InviteCode code, Boolean emailSent) {}

    @Transactional
    public InviteResult invite(String waitlistId, boolean sendEmail, String note, String createdBy) {
        WaitlistEntry entry = waitlistRepository.findById(waitlistId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Waitlist entry not found"));
        if (WaitlistEntry.STATUS_CONVERTED.equals(entry.getStatus())) {
            throw new VacademyException(HttpStatus.BAD_REQUEST,
                    "Waitlist entry already converted — no need to re-invite");
        }
        InviteCode code = inviteCodeService.createLocked(
                entry.getEmail(),
                entry.getPhoneNumber(),
                entry.getId(),
                null,
                note,
                createdBy);
        entry.setStatus(WaitlistEntry.STATUS_INVITED);
        waitlistRepository.save(entry);

        Boolean emailSent = null;
        if (sendEmail) {
            // Best-effort: if notification_service is down or misconfigured,
            // the admin can still copy the code from the UI and send manually.
            // emailSent surfaces back to the UI so the admin knows whether to
            // follow up.
            try {
                emailSent = sendInviteEmail(entry, code.getCode());
            } catch (Exception ex) {
                log.warn("vimotion: failed to send invite email to {} for code {}: {}",
                        entry.getEmail(), code.getCode(), ex.getMessage());
                emailSent = false;
            }
        }
        return new InviteResult(code, emailSent);
    }

    @Transactional
    public WaitlistEntry reject(String waitlistId) {
        WaitlistEntry entry = waitlistRepository.findById(waitlistId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Waitlist entry not found"));
        entry.setStatus(WaitlistEntry.STATUS_REJECTED);
        return waitlistRepository.save(entry);
    }

    /**
     * Flips a waitlist row to converted once its linked invite code is
     * redeemed at signup. Called from the signup path; tolerates "no row
     * found" silently because open codes don't have a waitlist_id.
     */
    @Transactional
    public void markConvertedByWaitlistId(String waitlistId) {
        if (!StringUtils.hasText(waitlistId)) return;
        waitlistRepository.findById(waitlistId).ifPresent(entry -> {
            entry.setStatus(WaitlistEntry.STATUS_CONVERTED);
            waitlistRepository.save(entry);
        });
    }

    public long countByStatus(String status) {
        return waitlistRepository.countByStatus(status);
    }

    public List<WaitlistEntry> topReferrers(int limit) {
        return waitlistRepository.findTopReferrers(PageRequest.of(0, Math.max(1, limit)));
    }

    public WaitlistStatusResponse toStatusResponse(WaitlistEntry entry) {
        return buildStatus(entry);
    }

    private boolean sendInviteEmail(WaitlistEntry entry, String code) {
        String redeemUrl = publicAppUrl + "/vim/onboarding?code=" + code;
        String subject = "Your Vimotion invite is ready";
        String body = """
                <p>Hi %s,</p>
                <p>Your Vimotion invite is here. Use the code below to finish setting
                up your studio — the link will prefill it for you.</p>
                <p style="font-family:monospace;font-size:18px;font-weight:600;">%s</p>
                <p><a href="%s" style="display:inline-block;background:#111;color:#fff;
                    padding:10px 18px;border-radius:6px;text-decoration:none;">
                    Redeem your invite</a></p>
                <p style="color:#666;font-size:12px;">If the button doesn't work, paste this
                URL into your browser: %s</p>
                """.formatted(entry.getFullName(), code, redeemUrl, redeemUrl);

        GenericEmailRequest request = new GenericEmailRequest();
        request.setTo(entry.getEmail());
        request.setSubject(subject);
        request.setBody(body);
        request.setEmailType("UTILITY_EMAIL");
        request.setService("vimotion-invite");
        Boolean result = notificationService.sendGenericHtmlMailViaUnifiedAsBoolean(
                request, platformInstituteId);
        return Boolean.TRUE.equals(result);
    }
}
