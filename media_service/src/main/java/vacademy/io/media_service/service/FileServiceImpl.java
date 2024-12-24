package vacademy.io.media_service.service;

import com.amazonaws.HttpMethod;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.amazonaws.services.s3.model.ListObjectsV2Result;
import com.amazonaws.services.s3.model.S3ObjectSummary;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.media_service.constant.MediaConstant;
import vacademy.io.media_service.dto.AcknowledgeRequest;
import vacademy.io.media_service.dto.PreSignedUrlResponse;
import vacademy.io.media_service.entity.FileMetadata;
import vacademy.io.media_service.entity.UserToFile;
import vacademy.io.media_service.enums.FileStatusEnum;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.repository.FileMetadataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.exceptions.DatabaseException;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.common.media.utils.MediaUtil;
import vacademy.io.media_service.repository.UserToFileRepository;

import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.nio.file.Paths;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class FileServiceImpl implements FileService {
    @Autowired
    private final AmazonS3 s3Client;
    @Value("${aws.bucket.name}")
    private String bucketName;

    @Value("${cloud.front.url}")
    private String cloudFrontUrl;
    @Autowired
    private FileMetadataRepository fileMetadataRepository;

    private final UserToFileRepository userToFileRepository;
    @Override
    public String uploadFile(MultipartFile multipartFile) throws IOException {

        String key = "SERVICE_UPLOAD/" + UUID.randomUUID() + "_" + multipartFile.getOriginalFilename();
        s3Client.putObject(bucketName, key, multipartFile.getInputStream(), null);
        FileMetadata metadata = new FileMetadata(multipartFile.getName(), Objects.isNull(multipartFile.getContentType()) ? "unknown" : multipartFile.getContentType(), key, "SERVICE_UPLOAD", "SERVICE_UPLOAD");
        fileMetadataRepository.save(metadata);
        return MediaConstant.s3baseurl + key;
    }

    @Override
    public Object downloadFile(String fileName) throws FileDownloadException, IOException {
        return null;
    }

    /**
     * Generates a pre-signed URL for uploading a file to S3.
     *
     * @param fileName The name of the file.
     * @param fileType The type of the file (e.g., image, document).
     * @param source   The source of the file (e.g., user, system).
     * @param sourceId The unique identifier of the source (e.g., user ID, system ID).
     * @return A pre-signed PreSignedUrlResponse for uploading the file.
     */
    public PreSignedUrlResponse getPreSignedUrl(String fileName, String fileType, String source, String sourceId) {
        // Set the expiration time for the pre-signed URL (1 hour from now)
        Date expiration = new Date(System.currentTimeMillis() + 3600000);

        // Generate the S3 key for the file
        String key = generateFileKey(fileName, source, sourceId);

        // Create a request to generate the pre-signed URL
        GeneratePresignedUrlRequest generatePresignedUrlRequest =
                new GeneratePresignedUrlRequest(bucketName, key)
                        .withMethod(HttpMethod.PUT)
                        .withExpiration(expiration);

        // Generate the pre-signed URL
        URL url = s3Client.generatePresignedUrl(generatePresignedUrlRequest);

        // Save file metadata (e.g. name, type, key) to the repository
        FileMetadata metadata =  new FileMetadata(fileName, fileType, key, source, sourceId);

        fileMetadataRepository.save(metadata);

        return new PreSignedUrlResponse(metadata.getId(), url.toString());
    }

    @Override
    public String getPublicUrlWithExpiry(String key, Integer days) {

        // Set the expiration time for the pre-signed URL
        Calendar c = Calendar.getInstance();
        c.setTime(new Date()); // Using today's date
        c.add(Calendar.DATE, days);

        // Create a request to generate the pre-signed URL
        GeneratePresignedUrlRequest generatePresignedUrlRequest =
                new GeneratePresignedUrlRequest(bucketName, key)
                        .withMethod(HttpMethod.GET)
                        .withExpiration(c.getTime());

        // Generate the pre-signed URL
        URL url = s3Client.generatePresignedUrl(generatePresignedUrlRequest);
        return url.toString();
    }

    @Override
    public String getUrlWithExpiryAndId(String id, Integer days) throws FileDownloadException {
        Date expiryDate = addTime(days);

        Optional<FileMetadata> fileMetadata = fileMetadataRepository.findById(id);
        if (fileMetadata.isEmpty()) throw new FileDownloadException("File Not Found");

//        // Create a request to generate the pre-signed URL
        GeneratePresignedUrlRequest generatePresignedUrlRequest =
                new GeneratePresignedUrlRequest(bucketName, fileMetadata.get().getKey())
                        .withMethod(HttpMethod.GET)
                        .withExpiration(expiryDate);

        // Generate the pre-signed URL
        URL url = s3Client.generatePresignedUrl(generatePresignedUrlRequest);

        //return cloudFrontUrl + fileMetadata.get().getKey();
        return url.toString();

    }

    public Date addTime(Integer days) {
        // Set the expiration time for the pre-signed URL
        Calendar c = Calendar.getInstance();
        c.setTime(new Date()); // Using today's date
        c.add(Calendar.DATE, days);

        return c.getTime();
    }

    @Override
    public String getPublicUrlWithExpiryAndId(String id) throws FileDownloadException {

        Optional<FileMetadata> fileMetadata = fileMetadataRepository.findById(id);
        if (fileMetadata.isEmpty()) throw new FileDownloadException("File Not Found");


        return MediaConstant.s3baseurl + fileMetadata.get().getKey();
    }

    @Override
    public Boolean acknowledgeClientUpload(AcknowledgeRequest request) {
        if (Objects.isNull(request.getFileId()) || Objects.isNull(request.getUserId())){
            return false;
        }
        Optional<FileMetadata> metadata = fileMetadataRepository.findById(request.getFileId());
        if (metadata.isPresent()) {
            metadata.get().setFileSize(request.getFileSize());
            FileMetadata folderIcon = null;
            if (!Objects.isNull(request.getFolderIconId())){
                folderIcon  = fileMetadataRepository.findById(request.getFolderIconId()).orElse(null);
            }
            UserToFile userToFile = new UserToFile(metadata.get(),folderIcon,request.getFolderName(),request.getUserId(),request.getSourceType(),request.getSourceId(), FileStatusEnum.ACTIVE.name());
            userToFileRepository.save(userToFile);
            return true;
        }
        return false;
    }

    @Override
    public boolean delete(String fileName) {
        File file = Paths.get(fileName).toFile();
        if (file.exists()) {
            file.delete();
            return true;
        }
        return false;
    }

    @Override
    public String getPublicUrlWithExpiryAndSource(String source, String sourceId, Integer expiryDays) throws FileDownloadException {
        // Set the expiration time for the pre-signed URL
        Calendar c = Calendar.getInstance();
        c.setTime(new Date()); // Using today's date
        c.add(Calendar.DATE, expiryDays);

        Optional<FileMetadata> fileMetadata = fileMetadataRepository.findTopBySourceAndSourceId(source, sourceId);
        if (fileMetadata.isEmpty()) throw new FileDownloadException("File Not Found");

        // Create a request to generate the pre-signed URL
        GeneratePresignedUrlRequest generatePresignedUrlRequest =
                new GeneratePresignedUrlRequest(bucketName, fileMetadata.get().getKey())
                        .withMethod(HttpMethod.GET)
                        .withExpiration(c.getTime());

        // Generate the pre-signed URL
        URL url = s3Client.generatePresignedUrl(generatePresignedUrlRequest);
        return url.toString();
    }

    @Override
    public List<Map<String, String>> getMultiplePublicUrlWithExpiryAndId(String fileIds) {
        List<String> dividedFileIds = MediaUtil.getFileIdsFromParam(fileIds);
        List<Map<String, String>> fileIdAndUrlList = new ArrayList<>();
        dividedFileIds.forEach((fileId) -> {
            try {
                fileIdAndUrlList.add(Map.of(fileId, getPublicUrlWithExpiryAndId(fileId)));
            } catch (FileDownloadException e) {
                throw new RuntimeException(e);
            }
        });
        return fileIdAndUrlList;
    }

    @Override
    public List<Map<String, String>> getMultipleUrlWithExpiryAndId(String fileIds, Integer expiryDays) {
        List<String> dividedFileIds = MediaUtil.getFileIdsFromParam(fileIds);
        List<Map<String, String>> fileIdAndUrlList = new ArrayList<>();
        dividedFileIds.forEach((fileId) -> {
            try {
                fileIdAndUrlList.add(Map.of(fileId, getUrlWithExpiryAndId(fileId, expiryDays)));
            } catch (FileDownloadException e) {
                throw new RuntimeException(e);
            }
        });
        return fileIdAndUrlList;
    }

    private boolean bucketIsEmpty() {
        ListObjectsV2Result result = s3Client.listObjectsV2(this.bucketName);
        if (result == null) {
            return false;
        }
        List<S3ObjectSummary> objects = result.getObjectSummaries();
        return objects.isEmpty();
    }

    private String generateFileKey(String fileName, String source, String sourceId) {
        return source + "/" + sourceId + "/" + UUID.randomUUID() + "-" + formatFileName(fileName);
    }

    public FileDetailsDTO getFileDetailsWithExpiryAndId(String id, Integer days) {

        Optional<FileMetadata> fileMetadata = fileMetadataRepository.findById(id);
        if (fileMetadata.isEmpty()) throw new DatabaseException("File Not Found");

        try {
            return FileDetailsDTO.builder()
                    .expiry(addTime(days))
                    .fileName(fileMetadata.get().getFileName())
                    .fileType(fileMetadata.get().getFileType())
                    .id(fileMetadata.get().getId())
                    .source(fileMetadata.get().getSource())
                    .sourceId(fileMetadata.get().getSourceId())
                    .url(getUrlWithExpiryAndId(id, days))
                    .createdOn(fileMetadata.get().getCreatedOn())
                    .updatedOn(fileMetadata.get().getUpdatedOn())
                    .build();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

    }

    @Override
    public List<FileDetailsDTO> getMultipleFileDetailsWithExpiryAndId(String ids, Integer days) throws FileDownloadException {

        List<String> dividedFileIds = MediaUtil.getFileIdsFromParam(ids);
        List<FileDetailsDTO> fileDetailsDTOS = new ArrayList<>();
        for (String fileId : dividedFileIds) {
            try {
                fileDetailsDTOS.add(getFileDetailsWithExpiryAndId(fileId, days));
            } catch (Exception e) {
                throw new FileDownloadException(e.getMessage());
            }
        }
        return fileDetailsDTOS;
    }

    private String formatFileName(String fileName) {
        if (StringUtils.hasText(fileName)) {
            return fileName
                    .replace(" ", "_")
                    .replace(",", "_")
                    .replace(":", "_")
                    .replace("?", "_")
                    .replace("/", "_")
                    .replace("\\", "_")
                    .replace("<", "_")
                    .replace(">", "_")
                    .replace("|", "_")
                    .replace("%20", "_");
        }
        return fileName;

    }

}