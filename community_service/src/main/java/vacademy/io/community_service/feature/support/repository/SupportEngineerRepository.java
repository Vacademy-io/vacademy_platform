package vacademy.io.community_service.feature.support.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.community_service.feature.support.entity.SupportEngineer;

import java.util.List;

@Repository
public interface SupportEngineerRepository extends JpaRepository<SupportEngineer, String> {

    List<SupportEngineer> findAllByOrderByNameAsc();

    List<SupportEngineer> findByActiveTrueOrderByNameAsc();
}
