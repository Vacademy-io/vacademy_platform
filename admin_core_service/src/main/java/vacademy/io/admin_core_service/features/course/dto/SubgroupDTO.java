package vacademy.io.admin_core_service.features.course.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * Represents a subgroup configuration sent from the Add/Edit Course UI.
 * Each subgroup results in a separate PackageSession sharing the same
 * level + session as the parent batch, but with its own name.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubgroupDTO {

    /**
     * Optional. When present (edit flow), the existing package_session (batch) id
     * for this subgroup; backend will update that batch's name instead of creating a new one.
     */
    private String id;

    /**
     * Display name of the subgroup. This will be stored in
     * PackageSession.name for the created or updated child batch.
     */
    private String name;
}

