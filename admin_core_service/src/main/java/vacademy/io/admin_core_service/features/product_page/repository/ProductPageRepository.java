package vacademy.io.admin_core_service.features.product_page.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPage;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProductPageRepository extends JpaRepository<ProductPage, String> {

    List<ProductPage> findByInstituteIdAndStatusIn(String instituteId, List<String> statuses);

    Optional<ProductPage> findByCode(String code);

    boolean existsByCode(String code);
}
