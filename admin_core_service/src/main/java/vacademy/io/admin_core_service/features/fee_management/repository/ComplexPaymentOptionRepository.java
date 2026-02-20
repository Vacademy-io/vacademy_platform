package vacademy.io.admin_core_service.features.fee_management.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.fee_management.entity.ComplexPaymentOption;

import java.util.List;
import java.util.Optional;

@Repository
public interface ComplexPaymentOptionRepository extends JpaRepository<ComplexPaymentOption, String> {

    List<ComplexPaymentOption> findByInstituteIdAndStatus(String instituteId, String status);

    List<ComplexPaymentOption> findByInstituteIdAndStatusNot(String instituteId, String status);

    Page<ComplexPaymentOption> findByInstituteIdAndStatusNot(String instituteId, String status, Pageable pageable);

    Optional<ComplexPaymentOption> findByIdAndStatusNot(String id, String status);

    List<ComplexPaymentOption> findByInstituteId(String instituteId);
}
