package vacademy.io.admin_core_service.features.mentorship.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Admin overview: mentor headcount, assignment totals, and the per-mentor list
 * with assigned-student counts. Recent tracking activity/meetings are composed
 * on the FE from the existing timeline ({@code /timeline/v1}) and meetings
 * ({@code /v1/meetings}) endpoints per mentor.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MentorDashboardDTO {
    private Integer totalMentors;
    private Integer totalActiveAssignments;
    private Integer distinctMentees;
    private Integer todaySessions;      // mentor bookings scheduled today (UTC day)
    private Integer upcomingSessions;   // mentor bookings in the next 7 days
    private Integer pendingRequests;    // learner mentor requests awaiting an admin decision
    private Integer completedSessions;  // sessions a mentor marked COMPLETED
    private Integer cancelledSessions;  // bookings cancelled or rescheduled away
    private Integer noShowSessions;     // sessions a mentor marked NO_SHOW
    private Integer sessionsAwaitingReview; // past sessions with no outcome recorded yet
    private Integer discoverableMentors; // mentors listed in the learner-facing directory
    private List<MentorDTO> mentors;
}
