package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.Data;
import java.util.List;

@Data
public class RoutingDTO {
    private String type; // goto, conditional, switch, end
    private String targetNodeId; // For goto
    private String condition; // For conditional
    private String trueNodeId; // For conditional true branch
    private String falseNodeId; // For conditional false branch
    private String expression; // For switch
    private List<CaseDTO> cases; // For switch
    private String defaultNodeId; // For switch default
}