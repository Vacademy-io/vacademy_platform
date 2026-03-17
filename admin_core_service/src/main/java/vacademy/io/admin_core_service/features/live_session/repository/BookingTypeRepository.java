package vacademy.io.admin_core_service.features.live_session.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.entity.BookingType;

import java.util.Optional;

@Repository
public interface BookingTypeRepository extends JpaRepository<BookingType, String> {
    Optional<BookingType> findByCodeAndInstituteId(String code, String instituteId);

    Optional<BookingType> findByCode(String code);

    // Find global or institute specific booking types
    Page<BookingType> findByInstituteIdOrInstituteIdIsNull(String instituteId, Pageable pageable);

    // Find only global booking types (institute_id is null)
    Page<BookingType> findByInstituteIdIsNull(Pageable pageable);

    // Find only institute-specific booking types
    Page<BookingType> findByInstituteId(String instituteId, Pageable pageable);
}
