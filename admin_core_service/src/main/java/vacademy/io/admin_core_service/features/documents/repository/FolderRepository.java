package vacademy.io.admin_core_service.features.documents.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.admin_core_service.features.documents.entity.Folder;

import java.util.List;

public interface FolderRepository extends JpaRepository<Folder, String> {
    List<Folder> findByUserIdAndStatusNot(String userId, String status);
}
