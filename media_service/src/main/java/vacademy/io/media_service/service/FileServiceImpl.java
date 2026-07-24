package vacademy.io.media_service.service;

import com.amazonaws.HttpMethod;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.CopyObjectRequest;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.amazonaws.services.s3.model.ListObjectsV2Result;
import com.amazonaws.services.s3.model.S3ObjectSummary;
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
import vacademy.io.media_service.constant.MediaConstant;
import vacademy.io.media_service.dto.AcknowledgeRequest;
import vacademy.io.media_service.dto.PreSignedUrlResponse;
import vacademy.io.media_service.entity.FileMetadata;
import vacademy.io.media_service.entity.UserToFile;
import vacademy.io.media_service.enums.FileStatusEnum;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.exceptions.FileUploadException;
import vacademy.io.media_service.repository.FileMetadataRepository;
import vacademy.io.media_service.repository.UserToFileRepository;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.util.*;

@Service
@Slf4j
@RequiredArgsConstructor
public class FileServiceImpl implements FileService {
    @Autowired
    private final AmazonS3 s3Client;
    private final UserToFileRepository userToFileRepository;

    @Value("${aws.bucket.name}")
    private String bucketName;

    @Value("${cloud.front.url}")
    private String cloudFrontUrl;

    @Value("${aws.s3.public-bucket}")
    private String publicBucket;

    /**
     * Cache-Control stamped on objects copied into the public bucket.
     * <p>
     * Every key from {@link #generateFileKey} embeds a fresh UUID, so a public
     * object's bytes never change once written — a re-upload is always a new key.
     * That makes these assets safely immutable, so browsers can reuse them without
     * revalidating rather than re-fetching on every page load.
     */
    private static final String PUBLIC_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";

    @Autowired
    private FileMetadataRepository fileMetadataRepository;

    @Override
    public String uploadFile(MultipartFile multipartFile) throws IOException {

        String key = "SERVICE_UPLOAD/" + UUID.randomUUID() + "_" + multipartFile.getOriginalFilename();
        s3Client.putObject(publicBucket, key, multipartFile.getInputStream(), null);
        FileMetadata metadata = new FileMetadata(multipartFile.getName(),
                Objects.isNull(multipartFile.getContentType()) ? "unknown" : multipartFile.getContentType(), key,
                "SERVICE_UPLOAD", "SERVICE_UPLOAD");
        fileMetadataRepository.save(metadata);
        return "https://" + publicBucket + ".s3.amazonaws.com/" + key;
    }

    @Override
    public FileDetailsDTO uploadFileWithDetails(MultipartFile multipartFile) throws FileUploadException, IOException {
        String key = "SERVICE_UPLOAD/" + UUID.randomUUID() + "_" + multipartFile.getOriginalFilename();
        s3Client.putObject(publicBucket, key, multipartFile.getInputStream(), null);
        FileMetadata fileMetadata = new FileMetadata(multipartFile.getName(),
                Objects.isNull(multipartFile.getContentType()) ? "unknown" : multipartFile.getContentType(), key,
                "SERVICE_UPLOAD", "SERVICE_UPLOAD");
        fileMetadata = fileMetadataRepository.save(fileMetadata);
        String url = "https://" + publicBucket + ".s3.amazonaws.com/" + key;

        FileDetailsDTO.FileDetailsDTOBuilder builder = FileDetailsDTO.builder()
                .expiry(addTime(100))
                .fileName(fileMetadata.getFileName())
                .fileType(fileMetadata.getFileType())
                .id(fileMetadata.getId())
                .source(fileMetadata.getSource())
                .sourceId(fileMetadata.getSourceId())
                .url(url)
                .createdOn(fileMetadata.getCreatedOn())
                .updatedOn(fileMetadata.getUpdatedOn());

        return builder.build();
    }

    @Override
    public FileDetailsDTO uploadPrivateFileWithDetails(MultipartFile multipartFile)
            throws FileUploadException, IOException {
        String key = "PRIVATE_UPLOAD/" + UUID.randomUUID() + "_" + multipartFile.getOriginalFilename();
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentType(
                multipartFile.getContentType() != null ? multipartFile.getContentType() : "application/octet-stream");
        metadata.setContentLength(multipartFile.getSize());
        // Server-side encryption at rest (SSE-S3, AES-256) — sensitive audio (PII / minors).
        metadata.setSSEAlgorithm(ObjectMetadata.AES_256_SERVER_SIDE_ENCRYPTION);
        s3Client.putObject(bucketName, key, multipartFile.getInputStream(), metadata);

        FileMetadata fileMetadata = new FileMetadata(multipartFile.getName(),
                Objects.isNull(multipartFile.getContentType()) ? "unknown" : multipartFile.getContentType(), key,
                "PRIVATE_UPLOAD", "PRIVATE_UPLOAD");
        fileMetadata = fileMetadataRepository.save(fileMetadata);

        // A presigned PRIVATE-bucket URL is a convenience for direct callers; the id is
        // the contract (recordings are fetched later via getUrlWithExpiryAndId). Never
        // fail the upload if presigning hiccups.
        String url = null;
        try {
            url = getUrlWithExpiryAndId(fileMetadata.getId(), 1);
        } catch (Exception ignored) {
            // best-effort
        }

        return FileDetailsDTO.builder()
                .expiry(addTime(1))
                .fileName(fileMetadata.getFileName())
                .fileType(fileMetadata.getFileType())
                .id(fileMetadata.getId())
                .source(fileMetadata.getSource())
                .sourceId(fileMetadata.getSourceId())
                .url(url)
                .createdOn(fileMetadata.getCreatedOn())
                .updatedOn(fileMetadata.getUpdatedOn())
                .build();
    }

    @Override
    public FileDetailsDTO uploadFileToKey(MultipartFile multipartFile, String key)
            throws FileUploadException, IOException {
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentType(
                multipartFile.getContentType() != null ? multipartFile.getContentType() : "application/octet-stream");
        metadata.setContentLength(multipartFile.getSize());
        s3Client.putObject(publicBucket, key, multipartFile.getInputStream(), metadata);
        FileMetadata fileMetadata = new FileMetadata(multipartFile.getName(),
                Objects.isNull(multipartFile.getContentType()) ? "unknown" : multipartFile.getContentType(), key,
                "SCORM_UPLOAD", "SCORM_UPLOAD");
        fileMetadata = fileMetadataRepository.save(fileMetadata);
        String url = "https://" + publicBucket + ".s3.amazonaws.com/" + key;

        FileDetailsDTO.FileDetailsDTOBuilder builder = FileDetailsDTO.builder()
                .expiry(addTime(100))
                .fileName(fileMetadata.getFileName())
                .fileType(fileMetadata.getFileType())
                .id(fileMetadata.getId())
                .source(fileMetadata.getSource())
                .sourceId(fileMetadata.getSourceId())
                .url(url)
                .createdOn(fileMetadata.getCreatedOn())
                .updatedOn(fileMetadata.getUpdatedOn());

        return builder.build();
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
     * @param sourceId The unique identifier of the source (e.g., user ID, system
     *                 ID).
     * @return A pre-signed PreSignedUrlResponse for uploading the file.
     */
    public PreSignedUrlResponse getPreSignedUrl(String fileName, String fileType, String source, String sourceId) {
        // Set the expiration time for the pre-signed URL (1 hour from now)
        Date expiration = new Date(System.currentTimeMillis() + 3600000);

        // Generate the S3 key for the file
        String key = generateFileKey(fileName, source, sourceId);

        // Create a request to generate the pre-signed URL
        GeneratePresignedUrlRequest generatePresignedUrlRequest = new GeneratePresignedUrlRequest(bucketName, key)
                .withMethod(HttpMethod.PUT)
                .withExpiration(expiration);

        // Generate the pre-signed URL
        URL url = s3Client.generatePresignedUrl(generatePresignedUrlRequest);

        // Save file metadata (e.g. name, type, key) to the repository
        FileMetadata metadata = new FileMetadata(fileName, fileType, key, source, sourceId);

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
        GeneratePresignedUrlRequest generatePresignedUrlRequest = new GeneratePresignedUrlRequest(bucketName, key)
                .withMethod(HttpMethod.GET)
                .withExpiration(c.getTime());

        // Generate the pre-signed URL
        URL url = s3Client.generatePresignedUrl(generatePresignedUrlRequest);
        return url.toString();
    }

    @Override
    public String getUrlWithExpiryAndId(String id, Integer days) throws FileDownloadException {
        Date expiryDate = addTime(days);
        try {
            Optional<FileMetadata> fileMetadata = fileMetadataRepository.findById(id);
            if (fileMetadata.isEmpty())
                throw new FileDownloadException("File Not Found");

            // Create a request to generate the pre-signed URL
            GeneratePresignedUrlRequest generatePresignedUrlRequest = new GeneratePresignedUrlRequest(bucketName,
                    fileMetadata.get().getKey())
                    .withMethod(HttpMethod.GET)
                    .withExpiration(expiryDate);

            // Generate the pre-signed URL
            URL url = s3Client.generatePresignedUrl(generatePresignedUrlRequest);

            // return cloudFrontUrl + fileMetadata.get().getKey();
            return url.toString();
        } catch (Exception e) {
            return null;
        }
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
        if (fileMetadata.isEmpty())
            throw new FileDownloadException("File Not Found");

        return MediaConstant.s3baseurl + fileMetadata.get().getKey();
    }

    @Override
    public Boolean acknowledgeClientUpload(AcknowledgeRequest request) {
        if (Objects.isNull(request.getFileId()) || Objects.isNull(request.getUserId())) {
            return false;
        }
        Optional<FileMetadata> metadata = fileMetadataRepository.findById(request.getFileId());
        if (metadata.isPresent()) {
            metadata.get().setFileSize(request.getFileSize());
            metadata.get().setHeight(request.getHeight());
            metadata.get().setWidth(request.getWidth());
            FileMetadata folderIcon = null;
            if (!Objects.isNull(request.getFolderIconId())) {
                folderIcon = fileMetadataRepository.findById(request.getFolderIconId()).orElse(null);
            }
            UserToFile userToFile = new UserToFile(metadata.get(), folderIcon, request.getFolderName(),
                    request.getUserId(), request.getSourceType(), request.getSourceId(), FileStatusEnum.ACTIVE.name());
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
    public String getPublicUrlWithExpiryAndSource(String source, String sourceId, Integer expiryDays)
            throws FileDownloadException {
        // Set the expiration time for the pre-signed URL
        Calendar c = Calendar.getInstance();
        c.setTime(new Date()); // Using today's date
        c.add(Calendar.DATE, expiryDays);

        Optional<FileMetadata> fileMetadata = fileMetadataRepository.findTopBySourceAndSourceId(source, sourceId);
        if (fileMetadata.isEmpty())
            throw new FileDownloadException("File Not Found");

        // Create a request to generate the pre-signed URL
        GeneratePresignedUrlRequest generatePresignedUrlRequest = new GeneratePresignedUrlRequest(bucketName,
                fileMetadata.get().getKey())
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
        if (fileMetadata.isEmpty())
            throw new DatabaseException("File Not Found");

        try {
            FileDetailsDTO.FileDetailsDTOBuilder builder = FileDetailsDTO.builder()
                    .expiry(addTime(days))
                    .fileName(fileMetadata.get().getFileName())
                    .fileType(fileMetadata.get().getFileType())
                    .id(fileMetadata.get().getId())
                    .source(fileMetadata.get().getSource())
                    .sourceId(fileMetadata.get().getSourceId())
                    .url(getUrlWithExpiryAndId(id, days))
                    .createdOn(fileMetadata.get().getCreatedOn())
                    .updatedOn(fileMetadata.get().getUpdatedOn());

            if (fileMetadata.get().getWidth() != null) {
                builder.width(fileMetadata.get().getWidth());
            }
            if (fileMetadata.get().getHeight() != null) {
                builder.height(fileMetadata.get().getHeight());
            }

            return builder.build();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

    }

    @Override
    public List<FileDetailsDTO> getMultipleFileDetailsWithExpiryAndId(String ids, Integer days)
            throws FileDownloadException {

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
                    .replace("%20", "_")
                    .replace("%", "_")
                    .replace("#", "_");
        }
        return fileName;

    }

    @Override
    public FileDetailsDTO acknowledgeClientUploadAndGetPublicUrl(AcknowledgeRequest acknowledgeRequest) {
        if (!acknowledgeClientUpload(acknowledgeRequest)) {
            return null;
        }
        FileMetadata fileMetadata = fileMetadataRepository.findById(acknowledgeRequest.getFileId())
                .orElseThrow(() -> new DatabaseException("File Not Found"));
        copyFileToPublicBucket(fileMetadata.getKey());
        FileDetailsDTO.FileDetailsDTOBuilder builder = FileDetailsDTO.builder()
                .url(getPublicUrl(acknowledgeRequest.getFileId(), publicBucket))
                .sourceId(fileMetadata.getSourceId())
                .source(fileMetadata.getSource())
                .id(fileMetadata.getId())
                .fileName(fileMetadata.getFileName())
                .fileType(fileMetadata.getFileType());

        if (fileMetadata.getWidth() != null) {
            builder.width(fileMetadata.getWidth());
        }
        if (fileMetadata.getHeight() != null) {
            builder.height(fileMetadata.getHeight());
        }

        return builder.build();

    }

    @Override
    public String getPublicUrl(String id, String bucketName) {
        Optional<FileMetadata> fileMetadata = fileMetadataRepository.findById(id);
        if (fileMetadata.isEmpty())
            throw new DatabaseException("File Not Found");

        String objectKey = fileMetadata.get().getKey().trim();

        // Percent-encode the key so special characters in the file name (e.g. '%')
        // don't break the URL. An unencoded '%' makes S3 reject the request with
        // "400 Invalid URI: isHexDigit". Path separators ('/') are preserved.
        return "https://" + bucketName + ".s3.amazonaws.com/" + encodeS3Key(objectKey);
    }

    /**
     * Percent-encodes an S3 object key for safe use in a URL path while keeping
     * the '/' separators intact. URLEncoder targets form encoding, so spaces come
     * back as '+'; we convert those to '%20' for a valid path segment.
     *
     * <p>Each segment is first percent-decoded once (see {@link #safePercentDecode})
     * and then encoded once. This makes the method idempotent: legacy keys that were
     * stored already URL-encoded (e.g. a file name "(90%_mgp_b3)" persisted as
     * "(90%25_mgp_b3)") collapse back to the real S3 object key before re-encoding,
     * so we no longer double-encode '%' into '%2525' and produce a 404 URL. A clean,
     * unencoded key passes through unchanged.
     */
    private String encodeS3Key(String objectKey) {
        if (!StringUtils.hasText(objectKey)) {
            return objectKey;
        }
        String[] segments = objectKey.split("/", -1);
        StringBuilder encoded = new StringBuilder();
        for (int i = 0; i < segments.length; i++) {
            if (i > 0) {
                encoded.append("/");
            }
            encoded.append(URLEncoder.encode(safePercentDecode(segments[i]), StandardCharsets.UTF_8)
                    .replace("+", "%20"));
        }
        return encoded.toString();
    }

    /**
     * Percent-decodes a single path segment, decoding only valid {@code %XX} hex
     * escapes (UTF-8 multibyte sequences included). Unlike {@link java.net.URLDecoder},
     * a literal '+' is preserved instead of becoming a space, and a stray '%' that is
     * not followed by two hex digits is kept verbatim instead of throwing. This lets
     * {@link #encodeS3Key} safely run decode-then-encode on keys that may or may not
     * already be encoded.
     */
    private String safePercentDecode(String segment) {
        if (segment == null || segment.indexOf('%') < 0) {
            return segment; // nothing to decode; keep '+' and everything else verbatim
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream(segment.length());
        for (int i = 0; i < segment.length(); i++) {
            char ch = segment.charAt(i);
            if (ch == '%' && i + 2 < segment.length()
                    && isHex(segment.charAt(i + 1)) && isHex(segment.charAt(i + 2))) {
                out.write((Character.digit(segment.charAt(i + 1), 16) << 4)
                        + Character.digit(segment.charAt(i + 2), 16));
                i += 2;
            } else {
                byte[] bytes = String.valueOf(ch).getBytes(StandardCharsets.UTF_8);
                out.write(bytes, 0, bytes.length);
            }
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    private boolean isHex(char c) {
        return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F');
    }

    public void copyFileToPublicBucket(String objectKey) {
        String key = objectKey.trim();

        // Supplying newObjectMetadata switches S3 to the REPLACE metadata directive,
        // which drops every header we do not re-set (Content-Type, SSE, …). So start
        // from the source object's own metadata and add Cache-Control on top of it —
        // never build a fresh ObjectMetadata here, or the copy would silently lose
        // the object's content type and encryption settings.
        ObjectMetadata metadata = s3Client.getObjectMetadata(bucketName, key);
        metadata.setCacheControl(PUBLIC_ASSET_CACHE_CONTROL);

        CopyObjectRequest copyRequest = new CopyObjectRequest(bucketName, key, publicBucket, key)
                .withNewObjectMetadata(metadata);
        s3Client.copyObject(copyRequest);
    }

    public PreSignedUrlResponse getPublicPreSignedUrl(String fileName, String fileType, String source,
            String sourceId) {
        // Set the expiration time for the pre-signed URL (1 hour from now)
        Date expiration = new Date(System.currentTimeMillis() + 3600000);

        // Generate the S3 key for the file
        String key = generateFileKey(fileName, source, sourceId);

        // Create a request to generate the pre-signed URL
        GeneratePresignedUrlRequest generatePresignedUrlRequest = new GeneratePresignedUrlRequest(bucketName, key)
                .withMethod(HttpMethod.PUT)
                .withExpiration(expiration);

        // Generate the pre-signed URL
        URL url = s3Client.generatePresignedUrl(generatePresignedUrlRequest);

        // Save file metadata (e.g. name, type, key) to the repository
        FileMetadata metadata = new FileMetadata(fileName, fileType, key, source, sourceId);

        fileMetadataRepository.save(metadata);

        return new PreSignedUrlResponse(metadata.getId(), url.toString());
    }

    @Override
    public String getPublicBucketUrl(String fileId, Integer expiryDays) throws FileDownloadException {
        Date expiryDate = addTime(expiryDays);

        Optional<FileMetadata> fileMetadata = fileMetadataRepository.findById(fileId);
        if (fileMetadata.isEmpty()) {
            throw new FileDownloadException("File Not Found");
        }

        // Generate presigned URL for public bucket
        GeneratePresignedUrlRequest generatePresignedUrlRequest = new GeneratePresignedUrlRequest(publicBucket,
                fileMetadata.get().getKey())
                .withMethod(HttpMethod.GET)
                .withExpiration(expiryDate);

        URL url = s3Client.generatePresignedUrl(generatePresignedUrlRequest);

        return url.toString();
    }

}