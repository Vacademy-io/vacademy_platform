package vacademy.io.admin_core_service.features.live_session.provider.support;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;

/**
 * In-memory {@link MultipartFile} backed by a byte array — lets us hand
 * already-downloaded bytes (e.g. a Zoom cloud recording) to
 * {@code FileService.uploadDataToS3}, which only needs {@link #getResource()}.
 */
public class ByteArrayMultipartFile implements MultipartFile {

    private final byte[] content;
    private final String filename;
    private final String contentType;

    public ByteArrayMultipartFile(byte[] content, String filename, String contentType) {
        this.content = content != null ? content : new byte[0];
        this.filename = filename;
        this.contentType = contentType;
    }

    @Override
    public String getName() {
        return "file";
    }

    @Override
    public String getOriginalFilename() {
        return filename;
    }

    @Override
    public String getContentType() {
        return contentType;
    }

    @Override
    public boolean isEmpty() {
        return content.length == 0;
    }

    @Override
    public long getSize() {
        return content.length;
    }

    @Override
    public byte[] getBytes() {
        return content;
    }

    @Override
    public InputStream getInputStream() {
        return new ByteArrayInputStream(content);
    }

    @Override
    public Resource getResource() {
        return new ByteArrayResource(content) {
            @Override
            public String getFilename() {
                return filename;
            }
        };
    }

    @Override
    public void transferTo(File dest) throws IOException {
        Files.write(dest.toPath(), content);
    }
}
