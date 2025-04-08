package vacademy.io.media_service.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.entity.FileConversionStatus;
import vacademy.io.media_service.repository.FileConversionStatusRepository;

import java.util.Optional;

@Service
public class FileConversionStatusService {

    @Autowired
    FileConversionStatusRepository fileConversionStatusRepository;


    public void startProcessing(String vendorId, String vendor, String fileId){

        FileConversionStatus fileConversionStatus = new FileConversionStatus();
        fileConversionStatus.setVendorFileId(vendorId);
        fileConversionStatus.setVendor(vendor);
        fileConversionStatus.setFileId(fileId);
        fileConversionStatus.setStatus("INIT");
        fileConversionStatusRepository.save(fileConversionStatus);
    }

    public Optional<FileConversionStatus> findByVendorFileId(String fileId){
        return fileConversionStatusRepository.findByVendorFileId(fileId);
    }

    public void updateHtmlText(String pdfId, String networkHtml) {
        var fileConversionStatus = fileConversionStatusRepository.findByVendorFileId(pdfId);
        if (fileConversionStatus.isPresent()) {
            fileConversionStatus.get().setHtmlText(networkHtml);
            fileConversionStatus.get().setStatus("SUCCESS");
            fileConversionStatusRepository.save(fileConversionStatus.get());
        }
    }
}
