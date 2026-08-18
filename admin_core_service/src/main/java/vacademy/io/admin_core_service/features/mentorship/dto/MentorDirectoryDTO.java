package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A mentor as a learner sees them in the Find-a-mentor directory. Deliberately
 * narrower than {@link MentorDTO}: no email, phone, user id or institute id, since
 * this is the one mentorship read a plain learner can make about mentors who are
 * not theirs. It also omits the booking slug: a learner books only their OWN
 * mentors, from My Mentors, so resolving a slug per directory row would be a query
 * per mentor for something nothing renders. {@code requestStatus} is the caller's
 * own request against this mentor, so the card can render Request / Pending /
 * Your mentor without a second call.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MentorDirectoryDTO {
    private String id;
    private String name;                 // display name, falling back to the auth full name
    private String title;
    private String bio;
    private String profileImageFileId;
    private List<String> expertiseTags;

    /** True when the mentor has hit {@code max_mentees} — the card shows "Fully booked". */
    private Boolean atCapacity;
    /** Remaining capacity; null when the mentor has no cap. */
    private Integer availableSlots;

    /** True when the caller is already mentored by this mentor. */
    private Boolean alreadyMentor;
    /** The caller's own request status against this mentor: PENDING/DECLINED/... or null. */
    private String requestStatus;
    private String requestId;
}
