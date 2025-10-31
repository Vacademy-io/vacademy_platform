package vacademy.io.admin_core_service.features.workflow.engine.http;

import vacademy.io.admin_core_service.features.workflow.dto.HttpRequestNodeConfigDTO;
import java.util.Map;

public interface HttpRequestStrategy {

    boolean canHandle(String requestType);

    Map<String, Object> execute(Map<String, Object> context, HttpRequestNodeConfigDTO.RequestConfig config);
}