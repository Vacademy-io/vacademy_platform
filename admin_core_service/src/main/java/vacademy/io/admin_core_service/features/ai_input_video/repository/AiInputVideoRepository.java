package vacademy.io.admin_core_service.features.ai_input_video.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.ai_input_video.entity.AiInputVideo;

import java.util.List;

@Repository
public interface AiInputVideoRepository extends JpaRepository<AiInputVideo, String> {

    List<AiInputVideo> findByInstituteIdOrderByCreatedAtDesc(String instituteId);
}
