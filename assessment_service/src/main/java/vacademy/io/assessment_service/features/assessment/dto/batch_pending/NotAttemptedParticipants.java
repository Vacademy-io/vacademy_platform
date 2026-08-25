package vacademy.io.assessment_service.features.assessment.dto.batch_pending;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import vacademy.io.assessment_service.features.assessment.dto.ParticipantsDetailsDto;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Turns "everyone enrolled in the batches" plus "everyone who already attempted" into the
 * page of learners who never tried the assessment.
 *
 * <p>Kept separate from the manager, and free of Spring and of any repository, so the set
 * arithmetic that decides whether a learner is chased for a missing submission is
 * unit-testable on its own.
 */
public final class NotAttemptedParticipants {

    private NotAttemptedParticipants() {
    }

    /**
     * The batches to actually look up: the assessment's assigned batches, narrowed to the
     * ones the caller asked for.
     *
     * <p>The intersection is the point. The admin UI builds its batch filter from every
     * batch in the INSTITUTE, not from the batches this assessment was assigned to, so a
     * teacher can select a batch that was never given this test. The attempted-side
     * queries are immune to that because they join {@code assessment_user_registration},
     * which only ever holds rows for this assessment — a foreign batch simply matches
     * nothing. This path starts from batch membership instead, so without the intersection
     * it would list every learner in that foreign batch as "has not attempted" and send a
     * teacher chasing people for an exam they were never set.
     *
     * @param assignedBatchIds batches this assessment is registered against
     * @param requestedBatchIds the filter chips; empty/null means "no narrowing"
     * @return batch ids to query, deduped and sorted so callers share one cache entry;
     *         empty when the request selects nothing this assessment was assigned to
     */
    public static List<String> resolveBatchIds(List<String> assignedBatchIds, List<String> requestedBatchIds) {
        if (assignedBatchIds == null || assignedBatchIds.isEmpty()) {
            return List.of();
        }
        Stream<String> assigned = assignedBatchIds.stream().filter(java.util.Objects::nonNull);
        if (requestedBatchIds != null && !requestedBatchIds.isEmpty()) {
            Set<String> requested = new HashSet<>(requestedBatchIds);
            assigned = assigned.filter(requested::contains);
        }
        return assigned.distinct().sorted().toList();
    }

    /**
     * @param enrolled       learners in the assessment's batches (one row per learner)
     * @param attemptedUserIds learners who have ANY attempt — status is irrelevant, since
     *                         someone who opened the paper did not "never try"
     * @param nameQuery       optional case-insensitive substring match on the learner name
     * @param pageable        page window; ordering is fixed (name, then user id) and does
     *                        not honour {@code pageable.getSort()}, because the caller has
     *                        no server-side sort for this tab
     */
    public static Page<ParticipantsDetailsDto> page(List<EnrolledLearnerDto> enrolled,
                                                    Set<String> attemptedUserIds,
                                                    String nameQuery,
                                                    Pageable pageable) {
        List<ParticipantsDetailsDto> rows = filterAndSort(enrolled, attemptedUserIds, nameQuery);

        // Guard both ends: an offset past the end must yield an empty page, not an
        // IndexOutOfBounds. A teacher sitting on page 3 while learners submit (shrinking
        // this list) hits exactly that.
        int from = (int) Math.min(pageable.getOffset(), rows.size());
        int to = Math.min(from + pageable.getPageSize(), rows.size());
        return new PageImpl<>(rows.subList(from, to), pageable, rows.size());
    }

    private static List<ParticipantsDetailsDto> filterAndSort(List<EnrolledLearnerDto> enrolled,
                                                              Set<String> attemptedUserIds,
                                                              String nameQuery) {
        if (enrolled == null || enrolled.isEmpty()) {
            return List.of();
        }
        Set<String> attempted = attemptedUserIds == null ? Set.of() : attemptedUserIds;
        String needle = (nameQuery == null || nameQuery.isBlank()) ? null : nameQuery.trim().toLowerCase();

        return enrolled.stream()
                .filter(learner -> learner != null && learner.getUserId() != null)
                .filter(learner -> !attempted.contains(learner.getUserId()))
                .filter(learner -> matchesName(learner, needle))
                // Same ordering contract as the rest of the submissions list: name first,
                // user id as the tie-breaker so paging is stable when two learners share a
                // name. Without the tie-breaker a page boundary between namesakes can
                // repeat one and skip the other.
                .sorted(Comparator
                        .comparing(NotAttemptedParticipants::nameOf, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(EnrolledLearnerDto::getUserId))
                .<ParticipantsDetailsDto>map(learner -> new NotAttemptedParticipantDto(
                        learner.getUserId(), learner.getFullName(), learner.getPackageSessionId()))
                .toList();
    }

    private static boolean matchesName(EnrolledLearnerDto learner, String needle) {
        if (needle == null) {
            return true;
        }
        return learner.getFullName() != null && learner.getFullName().toLowerCase().contains(needle);
    }

    /** Unnamed learners sort first rather than blowing up the comparator. */
    private static String nameOf(EnrolledLearnerDto learner) {
        return learner.getFullName() == null ? "" : learner.getFullName();
    }
}
