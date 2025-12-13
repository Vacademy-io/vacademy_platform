package vacademy.io.admin_core_service.features.workflow.engine;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.enums.NodeType; // Ensure NodeType includes HTTP_REQUEST

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class NodeHandlerRegistry {

    private final List<NodeHandler> nodeHandlers; // Use final and constructor injection
    private final Map<String, NodeHandler> handlerMap = new HashMap<>();

    // Use constructor injection
    public NodeHandlerRegistry(List<NodeHandler> nodeHandlers) {
        this.nodeHandlers = nodeHandlers;
    }

    @PostConstruct
    public void init() {
        if (nodeHandlers == null) {
            log.error("NodeHandlers list is null. Dependency injection might have failed.");
            return;
        }
        log.info("Initializing NodeHandlerRegistry with {} handlers...", nodeHandlers.size());
        for (NodeHandler handler : nodeHandlers) {
            // Determine the node type the handler supports
            String nodeType = getNodeTypeFromHandler(handler);
            if (nodeType != null && !nodeType.isBlank()) {
                String upperCaseNodeType = nodeType.toUpperCase();
                if (handlerMap.containsKey(upperCaseNodeType)) {
                    log.warn("Duplicate handler registration for type: {}. Existing: {}, New: {}",
                            upperCaseNodeType,
                            handlerMap.get(upperCaseNodeType).getClass().getSimpleName(),
                            handler.getClass().getSimpleName());
                } else {
                    handlerMap.put(upperCaseNodeType, handler);
                    log.info("Registered node handler: {} for type: {}",
                            handler.getClass().getSimpleName(), upperCaseNodeType);
                }
            } else {
                log.warn("Could not determine node type for handler: {}", handler.getClass().getSimpleName());
            }
        }
        log.info("NodeHandlerRegistry initialization complete. Registered types: {}", handlerMap.keySet());
    }

    // Determine node type based on handler implementation
    private String getNodeTypeFromHandler(NodeHandler handler) {
        // Check specific known types first
        if (handler instanceof ActionNodeHandler) {
            return NodeType.ACTION.name();
        } else if (handler instanceof QueryNodeHandler) {
            return NodeType.QUERY.name();
        } else if (handler instanceof TransformNodeHandler) {
            return NodeType.TRANSFORM.name();
        } else if (handler instanceof TriggerNodeHandler) {
            return NodeType.TRIGGER.name();
        } else if (handler instanceof SendWhatsAppNodeHandler) {
            // Assuming SEND_WHATSAPP might not be in NodeType enum, use String
            return "SEND_WHATSAPP";
        } else if (handler instanceof SendEmailNodeHandler) {
            // Assuming SEND_EMAIL might not be in NodeType enum or is handled differently
            return NodeType.SEND_EMAIL.name(); // Or return "SEND_EMAIL";
        } else if (handler instanceof HttpRequestNodeHandler) { // Check for the new handler
            return NodeType.HTTP_REQUEST.name();
        }
        else if (handler instanceof CombotNodeHandler) {
            return NodeType.COMBOT.name();
        }

        log.warn("Attempting dynamic type resolution for handler: {}", handler.getClass().getSimpleName());
        for (NodeType type : NodeType.values()) {
            try {
                if (handler.supports(type.name())) {
                    log.info("Dynamically resolved type {} for handler {}", type.name(), handler.getClass().getSimpleName());
                    return type.name();
                }
            } catch (Exception e) {
                // Catch potential errors in the supports method itself during this check
                log.error("Error calling supports({}) on handler {}", type.name(), handler.getClass().getSimpleName(), e);
            }
        }

        log.error("Could not determine node type for handler: {}", handler.getClass().getSimpleName());
        return null; // Could not determine type
    }

    public NodeHandler getHandler(String nodeType) {
        if (nodeType == null || nodeType.isBlank()) {
            log.warn("getHandler called with null or blank nodeType");
            return null;
        }
        String upperCaseNodeType = nodeType.toUpperCase();
        NodeHandler handler = handlerMap.get(upperCaseNodeType);
        if (handler == null) {
            log.warn("No handler found for node type: {}", upperCaseNodeType);
        }
        return handler;
    }

    public boolean hasHandler(String nodeType) {
        if (nodeType == null || nodeType.isBlank()) {
            return false;
        }
        return handlerMap.containsKey(nodeType.toUpperCase());
    }
}
