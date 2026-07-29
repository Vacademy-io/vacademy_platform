package vacademy.io.community_service.feature.pricing.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vacademy.io.community_service.feature.pricing.entity.PricingQuote;

import java.util.List;

public interface PricingQuoteRepository extends JpaRepository<PricingQuote, String> {

    List<PricingQuote> findBySubmissionIdOrderByCreatedAtDesc(String submissionId);

    @Query("""
            SELECT q FROM PricingQuote q
            WHERE (:status IS NULL OR q.status = :status)
              AND (:source IS NULL OR q.source = :source)
            ORDER BY q.createdAt DESC
            """)
    Page<PricingQuote> search(@Param("status") String status,
                             @Param("source") String source,
                             Pageable pageable);
}
