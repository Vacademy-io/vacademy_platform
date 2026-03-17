package vacademy.io.admin_core_service.features.migration.dto.v2;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request DTO for bulk enrollment import (API 2)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkEnrollmentImportRequestDTO {

    @JsonProperty("enrollments")
    private List<EnrollmentImportItemDTO> enrollments;

    /**
     * Global defaults for enrollments
     */
    @JsonProperty("defaults")
    private EnrollmentDefaultsDTO defaults;

    /**
     * If true, don't update existing enrollments (skip them)
     */
    @JsonProperty("skip_existing_enrollments")
    private Boolean skipExistingEnrollments;

    /**
     * If true, validate without persisting
     */
    @JsonProperty("dry_run")
    private Boolean dryRun;

    // Helper methods
    public boolean isDryRun() {
        return Boolean.TRUE.equals(dryRun);
    }

    public boolean shouldSkipExisting() {
        return Boolean.TRUE.equals(skipExistingEnrollments);
    }

    public EnrollmentDefaultsDTO getEffectiveDefaults() {
        return defaults != null ? defaults : EnrollmentDefaultsDTO.builder().build();
    }
}
