package vacademy.io.admin_core_service.features.telephony.core;

import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Minimal in-memory MultipartFile, used when uploading provider-fetched bytes
 * (call recordings) into media_service. Avoids dragging spring-test's
 * MockMultipartFile into prod just for one byte-array wrapper.
 *
 * <p>{@link #getResource()} is explicitly overridden. The default impl on
 * MultipartFile wraps {@code this} in a {@code MultipartFileResource} which
 * is supposed to forward {@code getFilename()} to {@link #getOriginalFilename()},
 * but in practice Spring's RestTemplate multipart writer doesn't always
 * inspect the wrapping resource's filename — so the request goes out
 * <em>anonymous</em> (no {@code filename="…"} in Content-Disposition). The
 * receiving server then sees only the form-field name ("file") and treats
 * the upload as nameless, which on media_service led to S3 keys without
 * our intended {@code call-recording-{id}.mp3} suffix and NoSuchKey errors
 * on later retrieval.
 *
 * <p>Returning a {@link ByteArrayResource} subclass that hard-codes
 * {@link #getFilename()} forces Spring's writer to emit the filename
 * unambiguously — same pattern Spring's own {@code MockMultipartFile}
 * uses.
 */
public final class TelephonyMultipartBytes implements MultipartFile {

    private final String name;
    private final String originalFilename;
    private final String contentType;
    private final byte[] content;

    public TelephonyMultipartBytes(String name, String originalFilename,
                                   String contentType, byte[] content) {
        this.name = name;
        this.originalFilename = originalFilename;
        this.contentType = contentType;
        this.content = content;
    }

    @Override public String getName()              { return name; }
    @Override public String getOriginalFilename()  { return originalFilename; }
    @Override public String getContentType()       { return contentType; }
    @Override public boolean isEmpty()             { return content == null || content.length == 0; }
    @Override public long getSize()                { return content == null ? 0 : content.length; }
    @Override public byte[] getBytes()             { return content; }
    @Override public InputStream getInputStream()  { return new ByteArrayInputStream(content); }

    @Override
    public Resource getResource() {
        // Anonymous subclass: hard-codes getFilename() so Spring's multipart
        // writer emits filename="..." in the Content-Disposition header.
        return new ByteArrayResource(content) {
            @Override
            public String getFilename() {
                return originalFilename;
            }
        };
    }

    @Override public void transferTo(java.io.File dest) throws IOException, IllegalStateException {
        if (dest == null) throw new FileNotFoundException("dest is null");
        try (OutputStream out = Files.newOutputStream(dest.toPath())) {
            out.write(content);
        }
    }

    @Override public void transferTo(Path dest) throws IOException, IllegalStateException {
        Files.write(dest, content);
    }
}
