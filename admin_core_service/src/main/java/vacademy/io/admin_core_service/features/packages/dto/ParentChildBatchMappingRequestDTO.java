package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

/**
 * Request payload for mapping a parent batch to one or more child batches.
 * <p>
 * JSON (snake_case) example:
 * {
 *   "institute_id": "INSTITUTE_ID",
 *   "parent_package_session_id": "PARENT_ID",
 *   "child_package_session_ids": ["CHILD_1", "CHILD_2"]
 * }
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ParentChildBatchMappingRequestDTO {

    /**
     * Institute context for validation / access control.
     */
    private String instituteId;

    /**
     * Parent batch (package_session) id. Will be marked is_parent = true.
     */
    private String parentPackageSessionId;

    /**
     * Child batch (package_session) ids. Each will get parent_id = parentPackageSessionId.
     */
    private List<String> childPackageSessionIds;
}

