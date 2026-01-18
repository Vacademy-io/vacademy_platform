package vacademy.io.media_service.config.cache;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface ClientCacheable {
    // Time to live in seconds
    int maxAgeSeconds();

    // Whether to treat cache as public or private
    CacheScope scope() default CacheScope.PUBLIC;

    // Additional vary headers beyond defaults
    String[] varyHeaders() default {};
}

