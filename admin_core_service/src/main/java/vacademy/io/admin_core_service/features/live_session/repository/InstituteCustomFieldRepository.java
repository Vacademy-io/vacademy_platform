package vacademy.io.admin_core_service.features.live_session.repository;


import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.live_session.entity.InstituteCustomField;

@Repository
public interface InstituteCustomFieldRepository extends JpaRepository<InstituteCustomField, String> {

    @Transactional
    void deleteByCustomFieldId(String customFieldId);
}

