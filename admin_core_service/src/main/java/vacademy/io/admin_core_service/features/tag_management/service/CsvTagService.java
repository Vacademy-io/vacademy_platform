package vacademy.io.admin_core_service.features.tag_management.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.admin_core_service.features.tag_management.dto.BulkUserTagOperationResultDTO;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CsvTagService {
    
    private final TagService tagService;
    
    /**
     * Process CSV file and add tag to all users in the file
     * CSV format: single column with user_id values
     */
    public BulkUserTagOperationResultDTO processCsvAndAddTag(
            MultipartFile csvFile, 
            String tagId, 
            String instituteId, 
            String createdByUserId) {
        
        if (csvFile.isEmpty()) {
            throw new IllegalArgumentException("CSV file is empty");
        }
        
        if (!isValidCsvFile(csvFile)) {
            throw new IllegalArgumentException("Invalid file format. Only CSV files are allowed");
        }
        
        try {
            List<String> userIds = parseCsvFile(csvFile);
            
            if (userIds.isEmpty()) {
                throw new IllegalArgumentException("No valid user IDs found in CSV file");
            }
            
            log.info("Processing CSV file with {} user IDs for tag: {}", userIds.size(), tagId);
            
            return tagService.addTagToUsers(userIds, tagId, instituteId, createdByUserId);
            
        } catch (IOException e) {
            log.error("Error processing CSV file", e);
            throw new RuntimeException("Failed to process CSV file: " + e.getMessage());
        }
    }
    
    /**
     * Parse CSV file and extract user IDs
     * Expected format: single column with user_id values, optionally with header
     */
    private List<String> parseCsvFile(MultipartFile csvFile) throws IOException {
        List<String> userIds = new ArrayList<>();
        
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(csvFile.getInputStream()))) {
            String line;
            boolean isFirstLine = true;
            int lineNumber = 0;
            
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                line = line.trim();
                
                // Skip empty lines
                if (line.isEmpty()) {
                    continue;
                }
                
                // Check if first line might be a header
                if (isFirstLine && isLikelyHeader(line)) {
                    log.info("Skipping header line: {}", line);
                    isFirstLine = false;
                    continue;
                }
                
                isFirstLine = false;
                
                // Handle CSV with commas (take first column) or single column
                String userId;
                if (line.contains(",")) {
                    String[] parts = line.split(",");
                    userId = parts[0].trim();
                } else {
                    userId = line;
                }
                
                // Remove quotes if present
                userId = userId.replaceAll("^\"|\"$", "");
                
                // Validate user ID format (basic validation)
                if (isValidUserId(userId)) {
                    userIds.add(userId);
                } else {
                    log.warn("Invalid user ID format at line {}: {}", lineNumber, userId);
                }
            }
        }
        
        // Remove duplicates while preserving order
        userIds = userIds.stream()
                .distinct()
                .collect(Collectors.toList());
        
        log.info("Parsed {} unique user IDs from CSV file", userIds.size());
        return userIds;
    }
    
    /**
     * Check if the first line is likely a header
     */
    private boolean isLikelyHeader(String line) {
        String lowerLine = line.toLowerCase();
        return lowerLine.contains("user") || 
               lowerLine.contains("id") || 
               lowerLine.equals("user_id") ||
               lowerLine.equals("userid") ||
               lowerLine.equals("student_id") ||
               lowerLine.equals("studentid");
    }
    
    /**
     * Basic validation for user ID format
     * Assumes user IDs are non-empty strings with reasonable length
     */
    private boolean isValidUserId(String userId) {
        return userId != null && 
               !userId.trim().isEmpty() && 
               userId.length() <= 255 && 
               userId.length() >= 1;
    }
    
    /**
     * Validate if the uploaded file is a valid CSV file
     */
    private boolean isValidCsvFile(MultipartFile file) {
        String filename = file.getOriginalFilename();
        String contentType = file.getContentType();
        
        return filename != null && 
               (filename.toLowerCase().endsWith(".csv") || 
                "text/csv".equals(contentType) ||
                "application/csv".equals(contentType) ||
                "text/plain".equals(contentType)); // Sometimes CSV files are uploaded as text/plain
    }
    
    /**
     * Process CSV file and add tag by name to all users in the file (auto-creates tag if needed)
     */
    public BulkUserTagOperationResultDTO processCsvAndAddTagByName(
            MultipartFile csvFile, 
            String tagName, 
            String instituteId, 
            String createdByUserId) {
        
        if (csvFile.isEmpty()) {
            throw new IllegalArgumentException("CSV file is empty");
        }
        
        if (!isValidCsvFile(csvFile)) {
            throw new IllegalArgumentException("Invalid file format. Only CSV files are allowed");
        }
        
        try {
            List<String> userIds = parseCsvFile(csvFile);
            
            if (userIds.isEmpty()) {
                throw new IllegalArgumentException("No valid user IDs found in CSV file");
            }
            
            log.info("Processing CSV file with {} user IDs for tag name: '{}'", userIds.size(), tagName);
            
            return tagService.addTagByNameToUsers(userIds, tagName, instituteId, createdByUserId);
            
        } catch (IOException e) {
            log.error("Error processing CSV file", e);
            throw new RuntimeException("Failed to process CSV file: " + e.getMessage());
        }
    }
    
    /**
     * Generate a sample CSV template content
     */
    public String generateCsvTemplate() {
        return "user_id\n" +
               "user123\n" +
               "user456\n" +
               "user789\n";
    }
    
    /**
     * Validate CSV file format without processing
     */
    public void validateCsvFormat(MultipartFile csvFile) {
        if (csvFile.isEmpty()) {
            throw new IllegalArgumentException("CSV file is empty");
        }
        
        if (!isValidCsvFile(csvFile)) {
            throw new IllegalArgumentException("Invalid file format. Only CSV files are allowed");
        }
        
        try {
            List<String> userIds = parseCsvFile(csvFile);
            if (userIds.isEmpty()) {
                throw new IllegalArgumentException("No valid user IDs found in CSV file");
            }
            log.info("CSV validation successful. Found {} valid user IDs", userIds.size());
        } catch (IOException e) {
            throw new RuntimeException("Failed to validate CSV file: " + e.getMessage());
        }
    }
}
