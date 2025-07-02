package vacademy.io.admin_core_service.features.common.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.common.entity.RatingAction;

import java.util.Optional;

public interface RatingActionRepository extends JpaRepository<RatingAction,String> {
    Optional<RatingAction> findByUserIdAndRatingId(String userId, String ratingId);
}
