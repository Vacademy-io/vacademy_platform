package vacademy.io.admin_core_service;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import vacademy.io.common.auth.config.SharedConfigurationReference;

import java.util.TimeZone;

@SpringBootApplication
@Import(SharedConfigurationReference.class)
@EnableWebSecurity
@EnableAsync
@EnableScheduling
public class AdminCoreServiceApplication {
    public static void main(String[] args) {
        // Force IST as the JVM default timezone so date/time handling is
        // identical across dev (local Windows machines that pick up UTC),
        // stage and prod. Critical for JDBC date columns — the PostgreSQL
        // driver builds java.sql.Date instances using the JVM default TZ,
        // so a meeting_date stored as 2026-05-26 was being read as
        // 2026-05-26 00:00 UTC and then wire-serialized as "2026-05-25"
        // when the JVM was UTC. Must be set before SpringApplication.run so
        // it takes effect before the JDBC datasource initialises.
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Kolkata"));
        SpringApplication.run(AdminCoreServiceApplication.class, args);
    }
}
