// utils/csv-response-parser.ts
import { SchemaFields } from '@/routes/manage-students/students-list/-types/bulk-upload-types';

/**
 * Parse the raw API response from the bulk upload endpoint
 * The response has a complex CSV-like format with headers and rows combined
 * Example format:
 * FULL_NAME,USERNAME,GENDER,...,STATUS,STATUS_MESSAGE,ERROR
 * John Doe,johndoe123,Male,...,false,,Error message here
 * Jane Smith,janesmith456,Female,...,true,,
 *
 * @param responseText The raw response text from the API
 * @returns An array of SchemaFields objects
 */
export const parseApiResponse = (responseText: string): SchemaFields[] => {
    if (!responseText || responseText.trim() === '') {
        return [];
    }

    try {
        // First, extract the header line and parse headers
        const lines = responseText.split('\n');
        if (lines.length === 0) {
            return [];
        }

        // Get header columns
        const headerLine = lines[0]?.trim() || '';
        const headerColumns = headerLine?.split(',').map((col) => col.trim()) || [];

        // Process each data row
        const results: SchemaFields[] = [];

        // For each row after the header
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i]?.trim() || '';
            if (!line) continue;

            // This is complex CSV parsing, accounting for potential quoted values with commas
            const rowValues: string[] = [];
            let currentValue = '';
            let insideQuotes = false;

            for (let j = 0; j < line.length; j++) {
                const char = line[j];

                if (char === '"') {
                    insideQuotes = !insideQuotes;
                } else if (char === ',' && !insideQuotes) {
                    rowValues.push(currentValue);
                    currentValue = '';
                } else {
                    currentValue += char;
                }
            }

            // Add the last value
            rowValues.push(currentValue);

            // Create object from header columns and row values
            const rowObject: SchemaFields = {};

            // Map each value to its corresponding header
            for (let j = 0; j < headerColumns.length && j < rowValues.length; j++) {
                const header = headerColumns[j];
                // Skip undefined headers
                if (header === undefined) continue;

                const value = rowValues[j] || '';

                // Special handling for specific columns
                if (header === 'STATUS') {
                    // Convert the string "true" or "false" to the actual boolean value
                    rowObject[header] = value.toLowerCase() === 'true' ? 'true' : 'false';
                } else {
                    rowObject[header] = value;
                }
            }

            // Special handling for the API response
            // If the status is false, extract the error message, which might span across columns
            if (rowObject.STATUS === 'false') {
                // If ERROR field doesn't exist, create it
                if (!rowObject.ERROR && rowValues.length > headerColumns.length) {
                    // Combine any extra fields after the headers as the error message
                    const extraText = rowValues.slice(headerColumns.length).join(',');
                    rowObject.ERROR = extraText;
                }
            }

            // Add only if it's a valid row with data
            if (Object.keys(rowObject).length > 0) {
                results.push(rowObject);
            }
        }

        return results;
    } catch (error) {
        console.error('Error parsing API response:', error);
        // Return a fallback parsing where each line becomes a row
        return parseResponseLineByLine(responseText);
    }
};

/**
 * Fallback parser for when the main parser fails
 * Tries to extract data from each line independently
 */
const parseResponseLineByLine = (responseText: string): SchemaFields[] => {
    return responseText
        .split('\n')
        .filter((line): line is string => typeof line === 'string' && line.trim() !== '')
        .map((line) => {
            const rowObject: SchemaFields = {
                raw: line,
            };

            // Try to extract status
            const statusMatch = line.match(/STATUS[=:,]\s*([^,]+)/i);
            if (statusMatch && statusMatch[1]) {
                rowObject.STATUS =
                    statusMatch[1].trim().toLowerCase() === 'true' ? 'true' : 'false';
            }

            // Try to extract error
            const errorMatch = line.match(/ERROR[=:,]\s*(.+)$/i);
            if (errorMatch && errorMatch[1]) {
                rowObject.ERROR = errorMatch[1].trim();
            }

            return rowObject;
        });
};

/**
 * Process the API response to determine upload success rates
 * @param response The parsed API response
 * @returns Statistics about the upload
 */
export const getUploadStats = (
    response: SchemaFields[]
): {
    success: number;
    failed: number;
    total: number;
    allSuccessful: boolean;
    allFailed: boolean;
    partialSuccess: boolean;
} => {
    if (!response || response.length === 0) {
        return {
            success: 0,
            failed: 0,
            total: 0,
            allSuccessful: false,
            allFailed: false,
            partialSuccess: false,
        };
    }

    let success = 0;
    let failed = 0;

    response.forEach((row) => {
        if (row.STATUS === 'true') {
            success++;
        } else {
            failed++;
        }
    });

    return {
        success,
        failed,
        total: response.length,
        allSuccessful: failed === 0 && success > 0,
        allFailed: success === 0 && failed > 0,
        partialSuccess: success > 0 && failed > 0,
    };
};

/**
 * Helper to detect if the response is actually a CSV-like format
 */
export const isCSVResponse = (response: unknown): boolean => {
    if (typeof response === 'string') {
        // Check if it has common CSV indicators
        return (
            response.includes(',') &&
            (response.includes('STATUS') ||
                response.includes('ERROR') ||
                response.trim().includes('\n'))
        );
    }
    return false;
};
