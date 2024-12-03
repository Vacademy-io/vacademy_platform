package vacademy.io.admin_core_service.core.config.converter;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Bean
    public ObjectArrayToPackageSessionConverter objectArrayToPackageSessionConverter() {
        return new ObjectArrayToPackageSessionConverter();
    }

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(objectArrayToPackageSessionConverter());
    }
}