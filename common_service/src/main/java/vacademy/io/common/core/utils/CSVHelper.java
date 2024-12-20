package vacademy.io.common.core.utils;

import org.springframework.web.multipart.MultipartFile;

/**
 * Utility class for handling CSV file operations.
 */
public class CSVHelper {

    // MIME type for CSV files
    public static String TYPE = "text/csv";

    /**
     * Checks if the given file has a CSV format.
     *
     * @param file the file to check
     * @return true if the file has a CSV MIME type, false otherwise
     */
    public static boolean hasCSVFormat(MultipartFile file) {
        return TYPE.equals(file.getContentType());
    }
}
