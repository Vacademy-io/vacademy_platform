package vacademy.io.admin_core_service.config.cache;

import org.springframework.core.MethodParameter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@RestControllerAdvice
public class ClientCacheResponseAdvice implements ResponseBodyAdvice<Object> {

    private static final List<String> DEFAULT_VARY_HEADERS = List.of(
            "Authorization",
            "X-Institute-Id",
            "X-Package-Session-Id",
            "X-User-Id"
    );

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        Method method = returnType.getMethod();
        if (method == null) return false;
        return method.isAnnotationPresent(ClientCacheable.class) ||
                returnType.getContainingClass().isAnnotationPresent(ClientCacheable.class);
    }

    @Override
    public Object beforeBodyWrite(Object body,
                                  MethodParameter returnType,
                                  MediaType selectedContentType,
                                  Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                  ServerHttpRequest request,
                                  ServerHttpResponse response) {

        ClientCacheable annotation = getAnnotation(returnType);
        if (annotation == null) return body;

        int maxAge = Math.max(annotation.maxAgeSeconds(), 0);
        CacheScope scope = annotation.scope();

        List<String> vary = new ArrayList<>(DEFAULT_VARY_HEADERS);
        vary.addAll(Arrays.asList(annotation.varyHeaders()));

        HttpHeaders headers = response.getHeaders();

        if (scope == CacheScope.NO_STORE || maxAge == 0) {
            headers.setCacheControl("no-store, no-cache, must-revalidate");
        } else {
            String visibility = scope == CacheScope.PUBLIC ? "public" : "private";
            headers.setCacheControl(visibility + ", max-age=" + maxAge);
        }

        headers.setVary(vary);

        return body;
    }

    private ClientCacheable getAnnotation(MethodParameter returnType) {
        Method method = returnType.getMethod();
        if (method != null && method.isAnnotationPresent(ClientCacheable.class)) {
            return method.getAnnotation(ClientCacheable.class);
        }
        Class<?> controllerClass = returnType.getContainingClass();
        if (controllerClass.isAnnotationPresent(ClientCacheable.class)) {
            return controllerClass.getAnnotation(ClientCacheable.class);
        }
        return null;
    }
}


