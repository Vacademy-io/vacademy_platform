package vacademy.io.admin_core_service.features.user_subscription.handler;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.user_subscription.dto.BenefitConfigDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class AbstractReferralProcessableBenefitFactory {
    private final Map<Class<? extends AbstractReferralProcessableBenefit>, AbstractReferralProcessableBenefit> handlerCache;

    @Autowired
    public AbstractReferralProcessableBenefitFactory(List<AbstractReferralProcessableBenefit> handlers) {
        // Create a map to cache handler instances by their class type for quick lookup
        this.handlerCache = handlers.stream()
                .collect(Collectors.toMap(AbstractReferralProcessableBenefit::getClass, Function.identity()));
    }

    public AbstractReferralProcessableBenefit getProcessor(String type) {

        Class<? extends AbstractReferralProcessableBenefit> handlerClass = findHandlerClass(type);

        AbstractReferralProcessableBenefit handler = handlerCache.get(handlerClass);
        if (handler == null) {
            throw new VacademyException("No processor found for benefit type: " + type);
        }
        return handler;
    }

    private Class<? extends AbstractReferralProcessableBenefit> findHandlerClass(String benefitType) {
        switch (benefitType) {
            case "CONTENT":
                return ContentBenefitProcessor.class;
            case "FREE_MEMBERSHIP_DAYS":
                return MemberShipBenefit.class;
            default:
                throw new VacademyException("No handler class configured for benefit type: " + benefitType);
        }
    }
}
