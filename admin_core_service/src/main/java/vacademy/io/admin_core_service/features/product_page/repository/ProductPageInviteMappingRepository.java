package vacademy.io.admin_core_service.features.product_page.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPageInviteMapping;

import java.util.List;

@Repository
public interface ProductPageInviteMappingRepository extends JpaRepository<ProductPageInviteMapping, String> {

    List<ProductPageInviteMapping> findByProductPageIdAndStatusIn(String coursePageId, List<String> statuses);

    @Modifying
    @Query("UPDATE ProductPageInviteMapping m SET m.status = :status WHERE m.productPage.id = :coursePageId")
    void updateStatusByProductPageId(@Param("coursePageId") String coursePageId, @Param("status") String status);
}
