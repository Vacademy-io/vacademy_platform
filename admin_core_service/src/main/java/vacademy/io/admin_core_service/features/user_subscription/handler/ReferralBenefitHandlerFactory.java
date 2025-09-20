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
public class ReferralBenefitHandlerFactory {

    private final Map<Class<? extends ReferralBenefitHandler>, ReferralBenefitHandler> handlerCache;

    @Autowired
    public ReferralBenefitHandlerFactory(List<ReferralBenefitHandler> handlers) {
        // Create a map to cache handler instances by their class type for quick lookup
        this.handlerCache = handlers.stream()
                .collect(Collectors.toMap(ReferralBenefitHandler::getClass, Function.identity()));
    }

    /**
     * Retrieves the appropriate benefit handler based on the benefit type.
     *
     * @param benefitDTO The benefit for which to find a handler.
     * @return The specific ReferralBenefitHandler instance.
     * @throws VacademyException if no suitable handler is found.
     */
    public ReferralBenefitHandler getProcessor(BenefitConfigDTO.BenefitDTO benefitDTO) {
        if (benefitDTO == null || benefitDTO.getType() == null) {
            throw new VacademyException("Benefit DTO or its type cannot be null");
        }

        Class<? extends ReferralBenefitHandler> handlerClass = findHandlerClass(benefitDTO.getType());

        ReferralBenefitHandler handler = handlerCache.get(handlerClass);
        if (handler == null) {
            throw new VacademyException("No processor found for benefit type: " + benefitDTO.getType());
        }
        return handler;
    }

    private Class<? extends ReferralBenefitHandler> findHandlerClass(BenefitConfigDTO.BenefitType type) {
        switch (type) {
            case FLAT_DISCOUNT:
                return FlatDiscountHandler.class;
            case PERCENTAGE_DISCOUNT:
                return PercentageDiscountHandler.class;
            case CONTENT:
                return ContentBenefitProcessor.class;
            case MEMBERSHIP_EXTENSION:
                return MemberShipBenefit.class;
             case POINTS:
                 return RewardPointBenefitHandler.class;
            default:
                throw new VacademyException("No handler class configured for benefit type: " + type);
        }
    }
}