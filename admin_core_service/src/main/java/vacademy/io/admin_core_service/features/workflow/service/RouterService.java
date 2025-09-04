package vacademy.io.admin_core_service.features.workflow.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.workflow.dto.RoutingDTO;
import vacademy.io.admin_core_service.features.workflow.engine.NodeHandler;
import vacademy.io.admin_core_service.features.workflow.entity.NodeTemplate;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
public class RouterService {
    @Autowired
    private List<NodeHandler> nodeHandlers;

    public void processRouting(List<RoutingDTO> routingDTOS,
                               Map<String,Object> ctx,
                               Map<String, NodeTemplate> nodeTemplates,
                               int countProcess) {
        if (countProcess > 20){
            throw new VacademyException("Count Process > 20");
        }
        if (routingDTOS == null || routingDTOS.isEmpty()) {
            return;
        }
        for (RoutingDTO routingDTO : routingDTOS) {
            NodeTemplate tmpl = nodeTemplates.get(routingDTO.getTargetNodeId());
            if (tmpl == null)
                break;

            String effectiveConfig = tmpl.getConfigJson();
            String nodeType = tmpl.getNodeType();

            NodeHandler handler = nodeHandlers.stream()
                    .filter(h -> h.supports(nodeType))
                    .findFirst()
                    .orElse(null);

            if (handler != null) {
                Map<String, Object> changes = handler.handle(ctx, effectiveConfig, nodeTemplates,countProcess);
                if (changes != null)
                    ctx.putAll(changes);
            }
        }
    }
}
