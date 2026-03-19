package vacademy.io.assessment_service.features.assessment.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vacademy.io.assessment_service.features.assessment.entity.FileConversionStatus;

import java.util.List;
import java.util.Optional;

public interface FileConversionStatusRepository extends JpaRepository<FileConversionStatus, String> {
    Optional<FileConversionStatus> findByVendorFileId(String fileId);
    Optional<FileConversionStatus> findByFileId(String fileId);
    List<FileConversionStatus> findAllByFileId(String fileId);
}