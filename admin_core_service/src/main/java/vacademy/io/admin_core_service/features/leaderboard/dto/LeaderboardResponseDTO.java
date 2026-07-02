package vacademy.io.admin_core_service.features.leaderboard.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/** A course/batch leaderboard: the ranked top entries plus the caller's own row. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardResponseDTO {
    private int totalLearners;
    private List<LeaderboardEntryDTO> entries;
    /** The current learner's own row (may be outside the returned top-N); null for admin/non-enrolled. */
    private LeaderboardEntryDTO currentUser;
    /** Course/batch name — populated for the public shareable page (null otherwise). */
    private String courseName;
    /** Institute branding — populated for the public page so it renders on ANY domain. */
    private String instituteName;
    private String instituteLogoFileId;
    private String instituteThemeCode;
    /** Whether names are anonymized (initials) — admin-configurable for the public page. */
    private boolean anonymized;
}
