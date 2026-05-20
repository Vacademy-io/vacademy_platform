package vacademy.io.admin_core_service.features.youtube.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class YoutubeUploadDefaultsDTO {
    /** Institute-level master switch. False until the admin opts in. */
    private boolean featureEnabled;
    private boolean autoUploadEnabled;
    private String privacyStatus;       // public | unlisted | private
    private boolean embeddable;
    private boolean publicStatsViewable;
    private boolean madeForKids;
    private String categoryId;
    private String license;             // youtube | creativeCommon
    private String defaultLanguage;
    private String tagsCsv;
    private String titleTemplate;
    private String descriptionTemplate;
    private boolean notifySubscribers;
    private String defaultPlaylistId;
}
