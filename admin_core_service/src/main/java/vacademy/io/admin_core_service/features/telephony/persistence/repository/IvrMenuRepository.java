package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.IvrMenu;

import java.util.List;
import java.util.Optional;

@Repository
public interface IvrMenuRepository extends JpaRepository<IvrMenu, String> {

    List<IvrMenu> findByInstituteIdOrderByCreatedAtDesc(String instituteId);

    /** A DID-specific enabled menu for this institute (highest precedence). */
    Optional<IvrMenu> findFirstByInstituteIdAndDialedNumberAndEnabledTrue(String instituteId, String dialedNumber);

    /** The institute's default enabled menu (no DID set). */
    Optional<IvrMenu> findFirstByInstituteIdAndDialedNumberIsNullAndEnabledTrue(String instituteId);
}
