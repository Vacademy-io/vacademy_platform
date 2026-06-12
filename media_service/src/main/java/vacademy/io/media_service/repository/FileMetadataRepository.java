package vacademy.io.media_service.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import vacademy.io.media_service.entity.FileMetadata;

import java.util.Optional;

@Repository
public interface FileMetadataRepository
        extends JpaRepository<FileMetadata, String>, JpaSpecificationExecutor<FileMetadata> {
    Optional<FileMetadata> findTopBySourceAndSourceId(String source, String sourceId);
}
