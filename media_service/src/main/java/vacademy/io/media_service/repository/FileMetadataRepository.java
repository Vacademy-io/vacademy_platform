package vacademy.io.media_service.repository;

import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.media_service.entity.FileMetadata;

import java.util.Optional;

@Repository
public interface FileMetadataRepository extends CrudRepository<FileMetadata, String> {
    Optional<FileMetadata> findTopBySourceAndSourceId(String source, String sourceId);
}