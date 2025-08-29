package vacademy.io.admin_core_service.features.workflow.engine;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.enums.NodeType;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class NodeHandlerRegistry {

    @Autowired
    private List<NodeHandler> nodeHandlers;

    private final Map<String, NodeHandler> handlerMap = new HashMap<>();

    @PostConstruct
    public void init() {
        for (NodeHandler handler : nodeHandlers) {
            // Register by node type - use the supports method for dynamic registration
            String nodeType = getNodeTypeFromHandler(handler);
            if (nodeType != null) {
                handlerMap.put(nodeType.toUpperCase(), handler);
                log.info("Registered node handler: {} for type: {}", handler.getClass().getSimpleName(), nodeType);
            }
        }
    }

    private String getNodeTypeFromHandler(NodeHandler handler) {
        // Try to determine the node type from the handler's supports method
        if (handler instanceof ActionNodeHandler) {
            return NodeType.ACTION.name();
        } else if (handler instanceof QueryNodeHandler) {
            return NodeType.QUERY.name();
        } else if (handler instanceof TransformNodeHandler) {
            return NodeType.TRANSFORM.name();
        } else if (handler instanceof TriggerNodeHandler) {
            return NodeType.TRIGGER.name();
        } else if (handler instanceof SendWhatsAppNodeHandler) {
            return "SEND_WHATSAPP";
        } else if (handler instanceof SendEmailNodeHandler) {
            return "SEND_EMAIL";
        } else {
            // For any other handler, try to determine type dynamically
            return null;
        }
    }

    public NodeHandler getHandler(String nodeType) {
        return handlerMap.get(nodeType.toUpperCase());
    }

    public boolean hasHandler(String nodeType) {
        return handlerMap.containsKey(nodeType.toUpperCase());
    }
}