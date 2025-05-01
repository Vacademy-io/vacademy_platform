package vacademy.io.media_service.repository;

import org.springframework.data.repository.CrudRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.media_service.entity.FileConversionStatus;

import java.util.Optional;

@Repository
public interface FileConversionStatusRepository extends CrudRepository<FileConversionStatus, String> {

    Optional<FileConversionStatus> findByVendorFileId(String fileId);
}