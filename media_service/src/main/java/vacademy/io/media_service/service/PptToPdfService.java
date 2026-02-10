package vacademy.io.media_service.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.common.exceptions.VacademyException;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

@Service
public class PptToPdfService {

    private static final Logger logger = LoggerFactory.getLogger(PptToPdfService.class);

    // Timeout for LibreOffice conversion (seconds)
    private static final int CONVERSION_TIMEOUT_SECONDS = 120;

    public byte[] convertPptToPdf(MultipartFile file) {
        return convertUsingLibreOffice(file);
    }

    public byte[] convertPptToPdfHighQuality(MultipartFile file, double scaleFactor) {
        // LibreOffice always produces full vector PDF – quality parameter not needed
        return convertUsingLibreOffice(file);
    }

    private byte[] convertUsingLibreOffice(MultipartFile file) {
        Path tempDir = null;
        try {
            // Create isolated temp directory for this conversion
            tempDir = Files.createTempDirectory("ppt-convert-");

            // Determine original extension
            String originalFilename = file.getOriginalFilename();
            String extension = ".pptx";
            if (originalFilename != null && originalFilename.toLowerCase().endsWith(".ppt")) {
                extension = ".ppt";
            }

            // Write uploaded file to temp dir
            File inputFile = new File(tempDir.toFile(), "input" + extension);
            file.transferTo(inputFile);

            logger.info("Starting LibreOffice conversion: file={}, size={} bytes",
                    originalFilename, file.getSize());

            // Run LibreOffice headless to convert to PDF
            ProcessBuilder pb = new ProcessBuilder(
                    "libreoffice",
                    "--headless",
                    "--norestore",
                    "--convert-to", "pdf",
                    "--outdir", tempDir.toString(),
                    inputFile.getAbsolutePath());
            pb.redirectErrorStream(true);
            pb.environment().put("HOME", tempDir.toString()); // Avoid profile lock conflicts

            Process process = pb.start();

            // Read process output for debugging
            String processOutput = new String(process.getInputStream().readAllBytes());

            boolean finished = process.waitFor(CONVERSION_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            if (!finished) {
                process.destroyForcibly();
                throw new VacademyException("PPT to PDF conversion timed out after "
                        + CONVERSION_TIMEOUT_SECONDS + " seconds");
            }

            int exitCode = process.exitValue();
            if (exitCode != 0) {
                logger.error("LibreOffice exit code: {}, output: {}", exitCode, processOutput);
                throw new VacademyException("PPT to PDF conversion failed (exit code " + exitCode + ")");
            }

            // Find the output PDF
            File outputPdf = new File(tempDir.toFile(), "input.pdf");
            if (!outputPdf.exists()) {
                logger.error("PDF output not found. LibreOffice output: {}", processOutput);
                throw new VacademyException("PDF output file not found after conversion");
            }

            byte[] pdfBytes = Files.readAllBytes(outputPdf.toPath());
            logger.info("PDF conversion complete: {} bytes", pdfBytes.length);
            return pdfBytes;

        } catch (IOException e) {
            logger.error("Failed to convert PPT to PDF", e);
            throw new VacademyException("Failed to convert PPT to PDF: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new VacademyException("PPT to PDF conversion was interrupted");
        } finally {
            // Clean up temp directory
            if (tempDir != null) {
                cleanupTempDir(tempDir);
            }
        }
    }

    private void cleanupTempDir(Path tempDir) {
        try {
            Files.walk(tempDir)
                    .sorted(java.util.Comparator.reverseOrder())
                    .forEach(path -> {
                        try {
                            Files.deleteIfExists(path);
                        } catch (IOException ignored) {
                        }
                    });
        } catch (IOException ignored) {
        }
    }
}
