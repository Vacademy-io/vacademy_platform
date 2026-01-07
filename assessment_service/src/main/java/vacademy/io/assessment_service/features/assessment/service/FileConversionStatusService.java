package vacademy.io.assessment_service.features.assessment.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.FileConversionStatus;
import vacademy.io.assessment_service.features.assessment.repository.FileConversionStatusRepository;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FileConversionStatusService {

    private final FileConversionStatusRepository fileConversionStatusRepository;

    public void startProcessing(String vendorId, String vendor, String fileId) {
        FileConversionStatus fileConversionStatus = new FileConversionStatus();
        fileConversionStatus.setVendorFileId(vendorId);
        fileConversionStatus.setVendor(vendor);
        fileConversionStatus.setFileId(fileId);
        fileConversionStatus.setStatus("INIT");
        fileConversionStatusRepository.save(fileConversionStatus);
    }

    public Optional<FileConversionStatus> findByVendorFileId(String fileId) {
        return fileConversionStatusRepository.findByVendorFileId(fileId);
    }

    public Optional<FileConversionStatus> findByFileId(String fileId) {
        return fileConversionStatusRepository.findByFileId(fileId);
    }

    public List<FileConversionStatus> findAllByFileId(String fileId) {
        return fileConversionStatusRepository.findAllByFileId(fileId);
    }

    public void updateHtmlText(String fileId, String htmlText) {
        Optional<FileConversionStatus> optionalStatus = fileConversionStatusRepository.findByFileId(fileId);
        if (optionalStatus.isPresent()) {
            FileConversionStatus status = optionalStatus.get();
            status.setHtmlText(htmlText);
            status.setStatus("SUCCESS");
            fileConversionStatusRepository.save(status);
        }
    }

    public void updateHtmlTextByVendorFileId(String vendorFileId, String htmlText) {
        Optional<FileConversionStatus> optionalStatus = fileConversionStatusRepository.findByVendorFileId(vendorFileId);
        if (optionalStatus.isPresent()) {
            FileConversionStatus status = optionalStatus.get();
            status.setHtmlText(htmlText);
            status.setStatus("SUCCESS");
            fileConversionStatusRepository.save(status);
        }
    }
}