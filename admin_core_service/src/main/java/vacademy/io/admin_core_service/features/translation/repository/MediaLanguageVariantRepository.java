package vacademy.io.admin_core_service.features.translation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.translation.entity.MediaLanguageVariant;

import java.util.Optional;

public interface MediaLanguageVariantRepository extends JpaRepository<MediaLanguageVariant, String> {

    Optional<MediaLanguageVariant> findByOwnerTypeAndOwnerIdAndLocaleAndKind(
            String ownerType, String ownerId, String locale, String kind);
}
