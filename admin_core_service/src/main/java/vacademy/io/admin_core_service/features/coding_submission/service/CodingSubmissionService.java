package vacademy.io.admin_core_service.features.coding_submission.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.coding_submission.dto.CodingSubmissionDto;
import vacademy.io.admin_core_service.features.coding_submission.dto.CodingSubmissionSummaryDto;
import vacademy.io.admin_core_service.features.coding_submission.dto.SubmitCodingRequestDto;
import vacademy.io.admin_core_service.features.coding_submission.entity.CodingSubmission;
import vacademy.io.admin_core_service.features.coding_submission.repository.CodingSubmissionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Date;

@Service
public class CodingSubmissionService {

    @Autowired
    private CodingSubmissionRepository repository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Persist a learner-submitted coding attempt. Always uses the calling
     * user's id as `learner_id` — clients can't impersonate.
     */
    public CodingSubmissionDto submit(CustomUserDetails user, SubmitCodingRequestDto req) {
        if (user == null || user.getUserId() == null) {
            throw new VacademyException(HttpStatus.UNAUTHORIZED,
                    "Authenticated user required to submit a coding attempt.");
        }
        if (req == null || req.getSlideId() == null || req.getSlideId().isBlank()) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "slideId is required.");
        }
        if (req.getLanguage() == null || req.getLanguage().isBlank()) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "language is required.");
        }
        if (req.getSourceCode() == null) {
            throw new VacademyException(HttpStatus.BAD_REQUEST,
                    "sourceCode is required (may be empty).");
        }

        CodingSubmission entity = CodingSubmission.builder()
                .slideId(req.getSlideId())
                .learnerId(user.getUserId())
                .packageSessionId(req.getPackageSessionId())
                .language(req.getLanguage())
                .sourceCode(req.getSourceCode())
                .verdict(safeStr(req.getVerdict(), "ERROR"))
                .passedCount(safeInt(req.getPassedCount()))
                .totalCount(safeInt(req.getTotalCount()))
                .score(safeDouble(req.getScore()))
                .maxPoints(safeDouble(req.getMaxPoints()))
                .testcaseResultsJson(req.getTestcaseResultsJson())
                .totalTimeMs(safeInt(req.getTotalTimeMs()))
                .peakMemoryKb(safeInt(req.getPeakMemoryKb()))
                .submittedAt(new Date())
                .sessionStartedAt(req.getSessionStartedAt())
                .build();

        return CodingSubmissionDto.from(repository.save(entity));
    }

    /**
     * List submissions for a slide. Auth rules:
     *   - Admins / root users: may see all submissions for the slide; optional
     *     learnerId filter narrows the list.
     *   - Other users: forced to learnerId = self, regardless of what they
     *     passed in the query (prevents cross-learner peeking).
     */
    public Page<CodingSubmissionSummaryDto> list(
            CustomUserDetails user,
            String slideId,
            String learnerIdFilter,
            int page,
            int size) {

        if (slideId == null || slideId.isBlank()) {
            throw new VacademyException(HttpStatus.BAD_REQUEST, "slideId is required.");
        }

        Pageable pageable = PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100));

        boolean privileged = isPrivileged(user);
        Page<CodingSubmission> rows;

        if (privileged) {
            if (learnerIdFilter != null && !learnerIdFilter.isBlank()) {
                rows = repository.findBySlideIdAndLearnerIdOrderBySubmittedAtDesc(
                        slideId, learnerIdFilter, pageable);
            } else {
                rows = repository.findBySlideIdOrderBySubmittedAtDesc(slideId, pageable);
            }
        } else {
            // Non-privileged: always scoped to self.
            String selfId = user != null ? user.getUserId() : null;
            if (selfId == null) {
                throw new VacademyException(HttpStatus.UNAUTHORIZED, "Unauthenticated request.");
            }
            rows = repository.findBySlideIdAndLearnerIdOrderBySubmittedAtDesc(
                    slideId, selfId, pageable);
        }

        return rows.map(CodingSubmissionSummaryDto::from);
    }

    /**
     * Fetch one submission by id. Privileged users get any row (including the
     * full hidden-test results, which they need for grading visibility). For
     * non-privileged users we still return their own row, but we redact the
     * `expected` and `stdout` fields on hidden test cases — otherwise a learner
     * could read the answer key from the network payload via DevTools.
     */
    public CodingSubmissionDto get(CustomUserDetails user, String id) {
        CodingSubmission row = repository.findById(id)
                .orElseThrow(() -> new VacademyException(
                        HttpStatus.NOT_FOUND, "Submission not found: " + id));

        boolean privileged = isPrivileged(user);
        if (!privileged) {
            String selfId = user != null ? user.getUserId() : null;
            if (selfId == null || !selfId.equals(row.getLearnerId())) {
                throw new VacademyException(
                        HttpStatus.FORBIDDEN, "Not allowed to view this submission.");
            }
            row.setTestcaseResultsJson(redactHiddenTests(row.getTestcaseResultsJson()));
        }
        return CodingSubmissionDto.from(row);
    }

    /**
     * Strip `expected`, `stdout`, and `stderr` from any test-case result whose
     * `visible` flag is false. Pass/fail, time/memory and the visible-vs-hidden
     * marker are preserved so the UI still renders meaningful per-test status.
     *
     * Returns the original JSON unchanged if it can't be parsed (defensive —
     * we'd rather surface odd data than corrupt it).
     */
    private String redactHiddenTests(String json) {
        if (json == null || json.isBlank()) return json;
        try {
            JsonNode root = objectMapper.readTree(json);
            if (!(root instanceof ArrayNode arr)) return json;
            for (JsonNode node : arr) {
                if (!(node instanceof ObjectNode obj)) continue;
                JsonNode visible = obj.get("visible");
                if (visible != null && visible.isBoolean() && !visible.booleanValue()) {
                    obj.remove("expected");
                    obj.remove("stdout");
                    obj.remove("stderr");
                }
            }
            return objectMapper.writeValueAsString(arr);
        } catch (Exception e) {
            // Defensive: malformed JSON shouldn't break the read path.
            return json;
        }
    }

    // ---- helpers ---------------------------------------------------------

    private static boolean isPrivileged(CustomUserDetails user) {
        if (user == null) return false;
        if (user.isRootUser()) return true;
        if (user.getAuthorities() == null) return false;
        return user.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .anyMatch(a -> a != null && (a.equalsIgnoreCase("ADMIN")
                        || a.equalsIgnoreCase("TEACHER")));
    }

    private static String safeStr(String s, String fallback) {
        return (s == null || s.isBlank()) ? fallback : s;
    }
    private static int safeInt(Integer i) { return i == null ? 0 : i; }
    private static double safeDouble(Double d) { return d == null ? 0d : d; }
}
