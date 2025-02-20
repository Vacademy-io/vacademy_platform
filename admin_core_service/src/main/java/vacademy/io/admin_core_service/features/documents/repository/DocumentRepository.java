package vacademy.io.admin_core_service.features.documents.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.documents.entity.Document;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, String> {
    List<Document> findByUserIdAndFolderIdAndStatusNotAndAccessTypeIn(String userId, String folderId, String status, List<String> accessTypes);

    List<Document> findByUserIdAndStatusNotAndAccessTypeInAndFolder_StatusNot(String userId, String status, List<String> accessTypes, String folderStatus);

}
