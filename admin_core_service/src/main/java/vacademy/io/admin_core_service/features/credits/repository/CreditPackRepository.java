package vacademy.io.admin_core_service.features.credits.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.credits.entity.CreditPack;

import java.util.List;
import java.util.Optional;

public interface CreditPackRepository extends JpaRepository<CreditPack, String> {

    /** Active packs ordered for the pack-picker UI. */
    List<CreditPack> findByIsActiveTrueOrderByDisplayOrderAsc();

    Optional<CreditPack> findByCode(String code);
}
