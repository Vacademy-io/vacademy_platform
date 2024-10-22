package vacademy.io.common.auth.config;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@Configuration
@ComponentScan("vacademy.io.*")
@EnableJpaRepositories("vacademy.io.*")
@EntityScan("vacademy.io.*")
public class SharedConfigurationReference {
}
