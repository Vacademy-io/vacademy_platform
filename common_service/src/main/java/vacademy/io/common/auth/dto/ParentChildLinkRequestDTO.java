package vacademy.io.common.auth.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request to link two EXISTING users as parent and child. Both users must
 * already exist; this only sets is_parent on the parent and linked_parent_id
 * on the child (back-fill only, never overwrites an existing linkage).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class ParentChildLinkRequestDTO {
    private String parentUserId;
    private String studentUserId;
}
