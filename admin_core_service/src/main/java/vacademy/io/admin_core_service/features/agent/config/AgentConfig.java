package vacademy.io.admin_core_service.features.agent.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.AsyncSupportConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Configuration for Agent feature, especially async/SSE support.
 */
@Configuration
public class AgentConfig implements WebMvcConfigurer {

    /**
     * Configure async timeout for SSE connections
     */
    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        // 5 minutes timeout for SSE
        configurer.setDefaultTimeout(5 * 60 * 1000L);
    }
}
