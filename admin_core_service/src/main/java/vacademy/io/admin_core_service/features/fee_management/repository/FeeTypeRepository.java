package vacademy.io.admin_core_service.features.fee_management.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.fee_management.entity.FeeType;

import java.util.List;

@Repository
public interface FeeTypeRepository extends JpaRepository<FeeType, String> {

    List<FeeType> findByCpoId(String cpoId);

    List<FeeType> findByCpoIdAndStatus(String cpoId, String status);

    Page<FeeType> findByCpoIdAndStatusNot(String cpoId, String status, Pageable pageable);
}
