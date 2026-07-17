package vacademy.io.admin_core_service.features.onboarding.steptype;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class OnboardingStepTypeHandlerRegistry {

    private final List<OnboardingStepTypeHandler> handlers;
    private final Map<String, OnboardingStepTypeHandler> handlerMap = new HashMap<>();

    public OnboardingStepTypeHandlerRegistry(List<OnboardingStepTypeHandler> handlers) {
        this.handlers = handlers;
    }

    @PostConstruct
    public void init() {
        if (handlers == null) {
            log.error("OnboardingStepTypeHandlers list is null. Dependency injection might have failed.");
            return;
        }
        for (OnboardingStepTypeHandler handler : handlers) {
            for (String candidate : candidateTypes()) {
                if (handler.supports(candidate)) {
                    handlerMap.putIfAbsent(candidate, handler);
                }
            }
        }
        log.info("OnboardingStepTypeHandlerRegistry initialized. Registered types: {}", handlerMap.keySet());
    }

    private String[] candidateTypes() {
        return java.util.Arrays.stream(vacademy.io.admin_core_service.features.onboarding.enums.OnboardingStepTypeEnum.values())
                .map(Enum::name)
                .toArray(String[]::new);
    }

    public OnboardingStepTypeHandler getHandler(String stepType) {
        if (stepType == null || stepType.isBlank()) {
            return null;
        }
        OnboardingStepTypeHandler handler = handlerMap.get(stepType.toUpperCase());
        if (handler == null) {
            log.warn("No onboarding step-type handler registered for type: {}", stepType);
        }
        return handler;
    }
}
