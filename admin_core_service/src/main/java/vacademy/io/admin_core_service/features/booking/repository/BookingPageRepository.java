package vacademy.io.admin_core_service.features.booking.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.booking.entity.BookingPage;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingPageRepository extends JpaRepository<BookingPage, String> {

    Optional<BookingPage> findByInstituteIdAndSlugAndStatusNot(String instituteId, String slug, String excludedStatus);

    Optional<BookingPage> findBySlugAndStatus(String slug, String status);

    Optional<BookingPage> findByInstituteIdAndSlugAndStatus(String instituteId, String slug, String status);

    List<BookingPage> findByInstituteIdAndStatusNot(String instituteId, String excludedStatus);

    List<BookingPage> findByInstituteIdAndAudienceIdAndStatusNot(String instituteId, String audienceId, String excludedStatus);

    List<BookingPage> findByInstituteIdAndHostUserIdAndStatusNot(String instituteId, String hostUserId, String excludedStatus);

    boolean existsByInstituteIdAndSlugAndStatusNot(String instituteId, String slug, String excludedStatus);
}
