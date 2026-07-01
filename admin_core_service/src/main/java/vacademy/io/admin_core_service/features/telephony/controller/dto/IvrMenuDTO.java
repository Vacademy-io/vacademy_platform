package vacademy.io.admin_core_service.features.telephony.controller.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Full-tree IVR menu payload for the admin builder. The frontend sends the whole
 * tree (menu + all nodes) on save; the service replaces the menu's nodes
 * atomically. {@code id} null on create (the service assigns one), set on update.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class IvrMenuDTO {
    private String id;
    private String instituteId;
    private String name;
    /** DID this IVR answers; null = the institute's default menu. */
    private String dialedNumber;
    /** Entry node id (must match one of the nodes' ids). */
    private String rootNodeId;
    private Boolean enabled;
    @Builder.Default
    private List<IvrNodeDTO> nodes = new ArrayList<>();
}
