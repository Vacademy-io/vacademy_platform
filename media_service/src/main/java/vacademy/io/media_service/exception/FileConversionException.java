package vacademy.io.media_service.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception for file conversion errors (PDF, Audio).
 */
public class FileConversionException extends AiProcessingException {

    public FileConversionException(String message) {
        super("FILE_CONVERSION_ERROR",
                "Failed to process your file. Please ensure the file is not corrupted and try again.",
                message);
    }

    public FileConversionException(String message, Throwable cause) {
        super("FILE_CONVERSION_ERROR",
                "Failed to process your file. Please ensure the file is not corrupted and try again.",
                message,
                cause);
    }

    public static FileConversionException uploadFailed(String filename) {
        return new FileConversionException(
                "FILE_UPLOAD_FAILED",
                String.format("Failed to upload file '%s'. Please check file size and format.", filename),
                String.format("File upload failed: %s", filename),
                HttpStatus.BAD_REQUEST);
    }

    public static FileConversionException conversionFailed(String fileId, String reason) {
        return new FileConversionException(
                "FILE_CONVERSION_FAILED",
                String.format("File conversion failed: %s. Please try with a different file.", reason),
                String.format("Conversion failed for file %s: %s", fileId, reason),
                HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public static FileConversionException stillProcessing(String fileId) {
        return new FileConversionException(
                "FILE_STILL_PROCESSING",
                "Your file is still being processed. Please wait a moment and try again.",
                String.format("File %s is still processing", fileId),
                HttpStatus.ACCEPTED);
    }

    public static FileConversionException invalidFormat(String expectedFormat) {
        return new FileConversionException(
                "INVALID_FILE_FORMAT",
                String.format("Invalid file format. Expected: %s", expectedFormat),
                String.format("Invalid format, expected: %s", expectedFormat),
                HttpStatus.BAD_REQUEST);
    }

    public FileConversionException(String errorCode, String userMessage, String technicalDetails, HttpStatus status) {
        super(errorCode, userMessage, technicalDetails, status);
    }
}
