package vacademy.io.admin_core_service.features.course_catalogue.dtos;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

public class CatalogueRevisionDTOs {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class SaveDraftRequest {
        private String catalogueJson;
        /** MANUAL | AI_WIZARD | AI_COPILOT (defaults to MANUAL). */
        private String source;
        private String aiRunId;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class RevisionResponse {
        private String id;
        private Integer revisionNo;
        private String status;
        private String source;
        private String aiRunId;
        private String createdByUserId;
        private Date createdAt;
        private Date updatedAt;
        /** Full config JSON — only populated on single-revision fetches. */
        private String catalogueJson;

        /* Draft fetch only: did the live site change after this draft was
         * started? Publishing such a draft would undo those live changes. */
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private Boolean liveChangedSinceDraft;
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private Integer liveRevisionNo;
        @JsonInclude(JsonInclude.Include.NON_NULL)
        private Date liveUpdatedAt;
    }
}
