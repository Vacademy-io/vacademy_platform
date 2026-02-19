package vacademy.io.admin_core_service.features.slide.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.slide.entity.ScormSlide;
import vacademy.io.admin_core_service.features.slide.repository.ScormSlideRepository;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import java.io.*;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScormService {

    private final ScormSlideRepository scormSlideRepository;
    private final MediaService mediaService;

    public ScormSlide uploadScormPackage(MultipartFile file) {
        File tempDir = null;
        try {
            // 1. Create temp directory
            tempDir = Files.createTempDirectory("scorm_pkg_" + System.currentTimeMillis()).toFile();

            // 2. Unzip file
            unzip(file.getInputStream(), tempDir);

            // 3. Parse manifest to find launch path
            String launchPath = parseLaunchPath(tempDir);

            // 4. Upload all files to Media Service (mimicking S3 folder structure)
            String rootFolder = "scorm/" + UUID.randomUUID().toString();
            Map<String, String> uploadedFileIds = new HashMap<>();
            uploadDirectory(tempDir, rootFolder, uploadedFileIds);

            // 5. Find the public URL of the launch file
            String launchFileKey = rootFolder + "/" + launchPath;
            log.info("Looking for launch file key: {}", launchFileKey);
            log.info("Uploaded file keys: {}", uploadedFileIds.keySet());
            log.info("Uploaded file URLs count: {}", uploadedFileIds.size());
            String launchFilePublicUrl = uploadedFileIds.get(launchFileKey);
            if (launchFilePublicUrl == null) {
                log.warn("Could not find public URL for launch file: {}. Available keys: {}", launchFileKey,
                        uploadedFileIds.keySet());
            } else {
                log.info("Found launch URL: {}", launchFilePublicUrl);
            }

            // 6. Create ScormSlide entity
            ScormSlide slide = new ScormSlide();
            slide.setId(UUID.randomUUID().toString());
            slide.setOriginalFileId(rootFolder); // storing the root folder path as ID/Ref
            slide.setLaunchPath(launchPath);
            slide.setScormVersion(detectScormVersion(tempDir));
            slide.setLaunchUrl(launchFilePublicUrl); // full public S3 URL for the launch file

            slide = scormSlideRepository.save(slide);

            return slide;

        } catch (Exception e) {
            log.error("Failed to process SCORM package", e);
            throw new RuntimeException("Failed to process SCORM package: " + e.getMessage());
        } finally {
            // Cleanup temp dir
            if (tempDir != null) {
                deleteDirectory(tempDir);
            }
        }
    }

    private void unzip(InputStream inputStream, File targetDir) throws IOException {
        try (ZipInputStream zis = new ZipInputStream(inputStream)) {
            ZipEntry zipEntry = zis.getNextEntry();
            while (zipEntry != null) {
                File newFile = newFile(targetDir, zipEntry);
                if (zipEntry.isDirectory()) {
                    if (!newFile.isDirectory() && !newFile.mkdirs()) {
                        throw new IOException("Failed to create directory " + newFile);
                    }
                } else {
                    File parent = newFile.getParentFile();
                    if (!parent.isDirectory() && !parent.mkdirs()) {
                        throw new IOException("Failed to create directory " + parent);
                    }
                    try (FileOutputStream fos = new FileOutputStream(newFile)) {
                        byte[] buffer = new byte[1024];
                        int len;
                        while ((len = zis.read(buffer)) > 0) {
                            fos.write(buffer, 0, len);
                        }
                    }
                }
                zipEntry = zis.getNextEntry();
            }
        }
    }

    private File newFile(File destinationDir, ZipEntry zipEntry) throws IOException {
        File destFile = new File(destinationDir, zipEntry.getName());
        String destDirPath = destinationDir.getCanonicalPath();
        String destFilePath = destFile.getCanonicalPath();
        if (!destFilePath.startsWith(destDirPath + File.separator)) {
            throw new IOException("Entry is outside of the target dir: " + zipEntry.getName());
        }
        return destFile;
    }

    private String parseLaunchPath(File dir) throws Exception {
        File manifest = new File(dir, "imsmanifest.xml");
        if (!manifest.exists()) {
            // Fallback: look for index.html or story.html in root
            if (new File(dir, "index.html").exists())
                return "index.html";
            if (new File(dir, "story.html").exists())
                return "story.html";
            throw new FileNotFoundException("imsmanifest.xml not found and no common launch file detected");
        }

        DocumentBuilderFactory dbFactory = DocumentBuilderFactory.newInstance();
        DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
        Document doc = dBuilder.parse(manifest);
        doc.getDocumentElement().normalize();

        // Basic parsing logic for SCORM 1.2/2004
        // Find <resource> with adlcp:scormType="sco"
        NodeList resources = doc.getElementsByTagName("resource");
        for (int i = 0; i < resources.getLength(); i++) {
            Element resource = (Element) resources.item(i);
            if ("sco".equalsIgnoreCase(resource.getAttribute("adlcp:scormType")) ||
                    "webcontent".equalsIgnoreCase(resource.getAttribute("type"))) {
                return resource.getAttribute("href");
            }
        }

        // Return first resource href as fallback
        if (resources.getLength() > 0) {
            return ((Element) resources.item(0)).getAttribute("href");
        }

        throw new RuntimeException("Could not determine launch path from manifest");
    }

    private String detectScormVersion(File dir) {
        // Simplified detection
        File manifest = new File(dir, "imsmanifest.xml");
        if (manifest.exists()) {
            try {
                String content = Files.readString(manifest.toPath());
                if (content.contains("CAM-1.3") || content.contains("2004"))
                    return "2004";
                if (content.contains("1.2"))
                    return "1.2";
            } catch (IOException e) {
                log.warn("Failed to read manifest for version detection", e);
            }
        }
        return "1.2"; // Default
    }

    private void uploadDirectory(File dir, String rootKey, Map<String, String> uploadedFileIds) throws IOException {
        if (dir.isDirectory()) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.isDirectory()) {
                        uploadDirectory(file, rootKey + "/" + file.getName(), uploadedFileIds);
                    } else {
                        String relativePath = rootKey + "/" + file.getName();
                        log.info("Uploading {} to {}", file.getName(), relativePath);
                        MultipartFile multipartFile = new CustomMultipartFile(file);
                        vacademy.io.common.media.dto.FileDetailsDTO result = mediaService.uploadFileToKey(multipartFile,
                                relativePath);
                        if (result != null && result.getUrl() != null) {
                            uploadedFileIds.put(relativePath, result.getUrl());
                        }
                    }
                }
            }
        }
    }

    private void deleteDirectory(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File file : files) {
                if (file.isDirectory()) {
                    deleteDirectory(file);
                } else {
                    file.delete();
                }
            }
        }
        dir.delete();
    }

}
