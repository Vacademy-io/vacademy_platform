package vacademy.io.admin_core_service.features.enrollment_policy.processor;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class EnrolmentProcessorFactory {

    private final PreExpiryProcessor preExpiryProcessor;
    private final WaitingPeriodProcessor waitingPeriodProcessor;
    private final FinalExpiryProcessor finalExpiryProcessor;

    public Optional<IEnrolmentPolicyProcessor> getProcessor(EnrolmentContext context) {
        if (context.getEndDate() == null) {
            return Optional.empty();
        }

        long daysPastExpiry = context.getDaysPastExpiry();
        long waitingPeriod = context.getWaitingPeriod();

        if (daysPastExpiry > waitingPeriod) {
            return Optional.of(finalExpiryProcessor);
        }

        if (daysPastExpiry >= 0) {
            return Optional.of(waitingPeriodProcessor);
        }

        return Optional.of(preExpiryProcessor);
    }
}
