package vacademy.io.admin_core_service.features.product_page.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPage;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductPageRepository extends JpaRepository<ProductPage, String> {

    List<ProductPage> findByInstituteIdAndStatusIn(String instituteId, List<String> statuses);

    Optional<ProductPage> findByCode(String code);

    boolean existsByCode(String code);

    /**
     * The page, holding a row lock until the transaction ends. Every write to
     * a page's mappings (the editor's save and the catalogue sync) takes it
     * first, so two of them never interleave: a sync reading the rows while a
     * save replaces them would add courses the save already re-inserted.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM ProductPage p WHERE p.id = :id")
    Optional<ProductPage> lockById(@Param("id") String id);
}
