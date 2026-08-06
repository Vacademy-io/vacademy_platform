package vacademy.io.community_service.feature.support.client;

import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;

/**
 * A bounded RestTemplate for support's outbound calls.
 *
 * <p>The application-wide bean is a bare {@code new RestTemplate()}, which inherits infinite
 * connect and read timeouts. Support notifications are dispatched synchronously inside the reply
 * request, so borrowing that bean would let a slow auth- or notification-service hang a support
 * agent's reply indefinitely. These timeouts cap the damage: the notification is abandoned and
 * logged, and the reply itself still succeeds.
 *
 * <p>Kept separate rather than adding timeouts to the shared bean, whose other consumers
 * (BBB health checks, diagnostics, DeepSeek) have very different latency profiles.
 */
@Configuration
public class SupportClientConfig {

    public static final String SUPPORT_REST_TEMPLATE = "supportRestTemplate";

    @Bean(SUPPORT_REST_TEMPLATE)
    public RestTemplate supportRestTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofSeconds(3))
                .setReadTimeout(Duration.ofSeconds(5))
                .build();
    }
}
