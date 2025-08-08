package vacademy.io.notification_service.features.announcements.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

/**
 * Custom validation annotation for mode settings
 */
@Documented
@Constraint(validatedBy = ModeSettingsValidator.class)
@Target({ElementType.FIELD})
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidModeSettings {
    String message() default "Invalid mode settings";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}