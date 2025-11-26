package vacademy.io.notification_service.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.util.HashMap;
import java.util.Map;

/**
 * EnvironmentPostProcessor that dynamically excludes Spring Cloud AWS SQS auto-configuration
 * when aws.sqs.enabled is set to false.
 * 
 * This is necessary because spring.autoconfigure.exclude doesn't support conditional values
 * based on other properties.
 */
public class SqsAutoConfigurationExcluder implements EnvironmentPostProcessor {

    private static final String SQS_ENABLED_PROPERTY = "aws.sqs.enabled";
    private static final String AUTOCONFIGURE_EXCLUDE_PROPERTY = "spring.autoconfigure.exclude";
    private static final String SQS_AUTO_CONFIGURATION_CLASS = "io.awspring.cloud.autoconfigure.sqs.SqsAutoConfiguration";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        // Check if aws.sqs.enabled is false
        String sqsEnabled = environment.getProperty(SQS_ENABLED_PROPERTY, "true");
        
        if ("false".equalsIgnoreCase(sqsEnabled)) {
            // Get existing exclusions if any
            String existingExclusions = environment.getProperty(AUTOCONFIGURE_EXCLUDE_PROPERTY, "");
            
            // Add SQS auto-configuration to exclusions if not already present
            String newExclusions;
            if (existingExclusions.isEmpty()) {
                newExclusions = SQS_AUTO_CONFIGURATION_CLASS;
            } else if (!existingExclusions.contains(SQS_AUTO_CONFIGURATION_CLASS)) {
                newExclusions = existingExclusions + "," + SQS_AUTO_CONFIGURATION_CLASS;
            } else {
                newExclusions = existingExclusions;
            }
            
            // Create a new property source with the exclusion
            Map<String, Object> props = new HashMap<>();
            props.put(AUTOCONFIGURE_EXCLUDE_PROPERTY, newExclusions);
            
            environment.getPropertySources().addFirst(
                new MapPropertySource("sqsExclusionPropertySource", props)
            );
            
            System.out.println("AWS SQS is disabled. Excluding SqsAutoConfiguration from auto-configuration.");
        }
    }
}

