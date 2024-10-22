package vacademy.io.media_service.repository;

import vacademy.io.media_service.entity.FileMetadata;
import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FileMetadataRepository extends CrudRepository<FileMetadata, String> {
    Optional<FileMetadata> findTopBySourceAndSourceId(String source, String sourceId);
}