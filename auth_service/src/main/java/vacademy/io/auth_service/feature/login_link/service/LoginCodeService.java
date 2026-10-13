package vacademy.io.auth_service.feature.login_link.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.auth_service.feature.login_link.entity.InstituteLoginLinkPolicy;
import vacademy.io.auth_service.feature.login_link.entity.LearnerLoginCode;
import vacademy.io.auth_service.feature.login_link.repository.InstituteLoginLinkPolicyRepository;
import vacademy.io.auth_service.feature.login_link.repository.LearnerLoginCodeRepository;
import vacademy.io.common.auth.entity.User;
import vacademy.io.common.auth.repository.UserRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Learner login codes: the {@code ?lc=} on a passwordless link.
 *
 * <ul>
 *   <li>Code = 16 bytes of SecureRandom, base64url without padding (22 characters, short enough
 *       for a WhatsApp button URL suffix). Only its SHA-256 hex is stored.</li>
 *   <li>Bound to one learner (a user with an ACTIVE/INVITED STUDENT role) in one institute.
 *       Codes are never minted for anyone else, so a key holder can never sign in as an admin
 *       or teacher this way.</li>
 *   <li>Reusable until {@code expires_at} (at most {@value #MAX_TTL_DAYS} days).</li>
 * </ul>
 *
 * The per-institute switch ({@code institute_login_link_policy}, off by default) turns the
 * whole thing on. Off: codes are ignored and the username-only links work as they always
 * have. On: a code is the only way in; see {@link #anyInstituteRequiresCode}. Codes can be
 * minted while it is off, so links can carry them before the switch is flipped.
 */
@Slf4j
@Service
public class LoginCodeService {

    public static final int DEFAULT_TTL_DAYS = 7;
    public static final int MAX_TTL_DAYS = 30;
    static final int CODE_BYTES = 16;
    private static final Pattern CODE_SHAPE = Pattern.compile("^[A-Za-z0-9_-]{16,64}$");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final List<String> STUDENT_ROLE = List.of("STUDENT");
    private static final List<String> LEARNER_STATUSES = List.of("ACTIVE", "INVITED");

    private final LearnerLoginCodeRepository codeRepository;
    private final InstituteLoginLinkPolicyRepository policyRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;

    private Clock clock = Clock.systemUTC();

    public LoginCodeService(LearnerLoginCodeRepository codeRepository,
                            InstituteLoginLinkPolicyRepository policyRepository,
                            UserRepository userRepository,
                            UserRoleRepository userRoleRepository) {
        this.codeRepository = codeRepository;
        this.policyRepository = policyRepository;
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
    }

    void setClock(Clock clock) {
        this.clock = clock;
    }

    // ── Mint ─────────────────────────────────────────────────────────────────

    /**
     * Mints a code for a learner of the institute, found by username or user id (exactly one).
     * The returned {@link MintedCode#code()} is the only time the code is visible.
     *
     * @param expiresInDays 1..{@value #MAX_TTL_DAYS}; null = {@value #DEFAULT_TTL_DAYS}
     * @param createdVia    {@link LearnerLoginCode#VIA_API_KEY} or {@link LearnerLoginCode#VIA_INTERNAL}
     */
    @Transactional
    public MintedCode mint(String instituteId, String username, String userId, Integer expiresInDays,
                           String createdVia, String createdBy) {
        if (isBlank(instituteId)) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "institute_id is required");
        }
        int days = expiresInDays == null ? DEFAULT_TTL_DAYS : expiresInDays;
        if (days < 1 || days > MAX_TTL_DAYS) {
            throw new VacademyException(HttpStatus.BAD_REQUEST,
                    "expires_in_days must be between 1 and " + MAX_TTL_DAYS);
        }
        User user = findLearner(instituteId, username, userId);

        String code = newCode();
        Instant now = clock.instant();
        LearnerLoginCode row = LearnerLoginCode.builder()
                .id(UUID.randomUUID().toString())
                .codeHash(sha256Hex(code))
                .userId(user.getId())
                .instituteId(instituteId)
                .expiresAt(now.plus(Duration.ofDays(days)))
                .createdVia(createdVia)
                .createdBy(createdBy)
                .createdAt(now)
                .useCount(0)
                .build();
        codeRepository.save(row);
        log.info("login-code: minted id={} user={} institute={} via={} by={} days={}",
                row.getId(), user.getId(), instituteId, createdVia, createdBy, days);
        return new MintedCode(code, row.getExpiresAt(), user.getId(), user.getUsername());
    }

    private User findLearner(String instituteId, String username, String userId) {
        boolean byUsername = !isBlank(username);
        boolean byId = !isBlank(userId);
        if (byUsername == byId) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "Send exactly one of username or user_id");
        }
        Optional<User> user;
        if (byUsername) {
            // STUDENT role (ACTIVE/INVITED) in this institute, by construction of the query.
            user = userRepository.findUserByUsernameAndInstituteId(username.trim(), instituteId);
        } else {
            user = userRepository.findById(userId.trim())
                    .filter(u -> isLearnerOf(u.getId(), instituteId));
        }
        return user.orElseThrow(() ->
                new VacademyException(HttpStatus.NOT_FOUND, "No learner with that username in this institute"));
    }

    private boolean isLearnerOf(String userId, String instituteId) {
        return userRoleRepository
                .findFirstByUserIdAndInstituteIdAndRoleNamesAndStatuses(userId, instituteId, STUDENT_ROLE, LEARNER_STATUSES)
                .isPresent();
    }

    // ── Redeem ───────────────────────────────────────────────────────────────

    /**
     * The institute a code was minted for, whatever its state (expired and revoked codes
     * included), or empty for a malformed or unknown code. Decides whether the code is
     * honoured at all: only for an institute with the switch on.
     */
    @Transactional(readOnly = true)
    public Optional<String> instituteOf(String code) {
        if (code == null || !CODE_SHAPE.matcher(code.trim()).matches()) {
            return Optional.empty();
        }
        return codeRepository.findByCodeHash(sha256Hex(code.trim())).map(LearnerLoginCode::getInstituteId);
    }

    /**
     * The learner the code signs in, or empty when the code is malformed, unknown, revoked,
     * expired, or does not match the username / institute the request names (both optional).
     * One answer for all of them, so a caller cannot probe which.
     */
    @Transactional
    public Optional<User> redeem(String code, String username, String instituteId, String clientIp) {
        if (code == null || !CODE_SHAPE.matcher(code.trim()).matches()) {
            return Optional.empty();
        }
        Instant now = clock.instant();
        Optional<LearnerLoginCode> found = codeRepository.findByCodeHash(sha256Hex(code.trim()));
        if (found.isEmpty() || !found.get().isUsableAt(now)) {
            return Optional.empty();
        }
        LearnerLoginCode row = found.get();
        if (!isBlank(instituteId) && !instituteId.trim().equals(row.getInstituteId())) {
            log.warn("login-code: institute mismatch id={} code_institute={} request_institute={}",
                    row.getId(), row.getInstituteId(), instituteId);
            return Optional.empty();
        }
        Optional<User> user = userRepository.findById(row.getUserId());
        if (user.isEmpty()) {
            return Optional.empty();
        }
        if (!isBlank(username) && !username.trim().equalsIgnoreCase(user.get().getUsername())) {
            // A code for one learner pasted onto another learner's /go/<username> link.
            log.warn("login-code: username mismatch id={} code_user={}", row.getId(), row.getUserId());
            return Optional.empty();
        }
        if (!isLearnerOf(row.getUserId(), row.getInstituteId())) {
            // Removed from the institute after the code was minted.
            return Optional.empty();
        }
        codeRepository.recordUse(row.getId(), now, clientIp == null ? null : truncate(clientIp, 64));
        return user;
    }

    // ── Policy ───────────────────────────────────────────────────────────────

    /**
     * True when an institute the user belongs to (any role, any status), or the institute the
     * request names, requires a code. Every institute is checked, not just the requested one:
     * the JWT carries authorities for all of them, so leaving out or swapping institute_id must
     * not get around the switch.
     */
    @Transactional(readOnly = true)
    public boolean anyInstituteRequiresCode(String userId, String requestedInstituteId) {
        List<String> instituteIds = new java.util.ArrayList<>(userRoleRepository.findDistinctInstituteIdsByUserId(userId));
        if (!isBlank(requestedInstituteId)) {
            instituteIds.add(requestedInstituteId.trim());
        }
        return !instituteIds.isEmpty() && policyRepository.anyRequiresLoginCode(instituteIds);
    }

    @Transactional(readOnly = true)
    public boolean requiresCode(String instituteId) {
        return policyRepository.findById(instituteId).map(InstituteLoginLinkPolicy::isRequireLoginCode).orElse(false);
    }

    @Transactional
    public InstituteLoginLinkPolicy setRequiresCode(String instituteId, boolean require, String actorUserId) {
        InstituteLoginLinkPolicy policy = policyRepository.findById(instituteId)
                .orElse(InstituteLoginLinkPolicy.builder().instituteId(instituteId).build());
        policy.setRequireLoginCode(require);
        policy.setUpdatedBy(actorUserId);
        policy.setUpdatedAt(clock.instant());
        InstituteLoginLinkPolicy saved = policyRepository.save(policy);
        log.warn("login-code: institute={} require_login_code={} by={}", instituteId, require, actorUserId);
        return saved;
    }

    public Optional<InstituteLoginLinkPolicy> findPolicy(String instituteId) {
        return policyRepository.findById(instituteId);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    static String newCode() {
        byte[] bytes = new byte[CODE_BYTES];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String truncate(String s, int n) {
        return s.length() <= n ? s : s.substring(0, n);
    }

    /** Plaintext code + what it is bound to; returned exactly once, at mint. */
    public record MintedCode(String code, Instant expiresAt, String userId, String username) {
    }
}
