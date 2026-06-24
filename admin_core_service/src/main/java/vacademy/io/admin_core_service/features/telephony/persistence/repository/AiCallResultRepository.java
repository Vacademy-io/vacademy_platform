package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiCallResult;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface AiCallResultRepository extends JpaRepository<AiCallResult, String> {

    /** Idempotency lookup: a re-POST of the same call updates the existing row. */
    Optional<AiCallResult> findByProviderAndCallUuid(String provider, String callUuid);

    /** Batch read-time join for Call History: fetch AI results for a page of call-log ids (avoids N+1). */
    List<AiCallResult> findByCallLogIdIn(Collection<String> callLogIds);
}
