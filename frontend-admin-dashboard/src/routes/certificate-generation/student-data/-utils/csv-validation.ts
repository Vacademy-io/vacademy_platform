import {
    CsvValidationResult,
    CsvTemplateRow,
    CertificateStudentData,
    CsvValidationError,
    CsvValidationWarning,
    ColumnDataType,
} from '@/types/certificate/certificate-types';

/**
 * Validates CSV data against requirements:
 * 1. First 3 columns must be user_id, enrollment_number, student_name
 * 2. All selected students must be present in CSV
 * 3. No extra students in CSV that weren't selected
 * 4. Headers after 3rd column must be unique
 * 5. Data type consistency within columns
 */
export function validateCsvData(
    csvData: CsvTemplateRow[],
    headers: string[],
    selectedStudents: CertificateStudentData[]
): CsvValidationResult {
    const errors: CsvValidationError[] = [];
    const warnings: CsvValidationWarning[] = [];

    // 1. Validate required headers
    const requiredHeaders = ['user_id', 'enrollment_number', 'student_name'];
    for (let i = 0; i < requiredHeaders.length; i++) {
        if (i >= headers.length || headers[i] !== requiredHeaders[i]) {
            errors.push({
                row: 0,
                column: `Column ${i + 1}`,
                message: `Column ${i + 1} must be '${requiredHeaders[i]}', found '${headers[i] || 'missing'}'`,
                type: 'invalid_header',
            });
        }
    }

    // 2. Validate unique headers after 3rd column
    const dynamicHeaders = headers.slice(3);
    const seenHeaders = new Set<string>();

    for (let i = 0; i < dynamicHeaders.length; i++) {
        const header = dynamicHeaders[i];
        if (header && seenHeaders.has(header)) {
            errors.push({
                row: 0,
                column: header,
                message: `Duplicate header '${header}' found. All headers after the 3rd column must be unique.`,
                type: 'invalid_header',
            });
        } else if (header) {
            seenHeaders.add(header);
        }
    }

    // 3. Create lookup maps for validation
    const selectedStudentIds = new Set(selectedStudents.map((s) => s.user_id));
    const csvStudentIds = new Set(csvData.map((row) => row.user_id));

    // 4. Check for missing students (selected but not in CSV)
    const missingStudents = selectedStudents.filter((s) => !csvStudentIds.has(s.user_id));
    missingStudents.forEach((student) => {
        errors.push({
            row: 0,
            message: `Selected student '${student.full_name || student.user_id}' (ID: ${student.user_id}) is missing from CSV`,
            type: 'missing_student',
        });
    });

    // 5. Check for extra students (in CSV but not selected)
    const extraStudents = csvData.filter((row) => !selectedStudentIds.has(row.user_id));
    extraStudents.forEach((student, index) => {
        errors.push({
            row: csvData.indexOf(student) + 2, // +2 because 1-indexed and header row
            message: `Student '${student.student_name}' (ID: ${student.user_id}) was not selected for certificate generation`,
            type: 'extra_student',
        });
    });

    // 6. Validate data consistency and types
    if (dynamicHeaders.length > 0) {
        const columnTypes = detectColumnTypes(csvData, dynamicHeaders);

        dynamicHeaders.forEach((header) => {
            const columnType = columnTypes[header];
            csvData.forEach((row, rowIndex) => {
                const value = row[header];
                if (value !== undefined && value !== '') {
                    const actualType = getValueType(value);

                    if (
                        columnType !== 'unknown' &&
                        actualType !== columnType &&
                        actualType !== 'unknown'
                    ) {
                        warnings.push({
                            row: rowIndex + 2,
                            column: header,
                            message: `Value '${value}' in column '${header}' appears to be ${actualType} but column is mostly ${columnType}`,
                            type: 'data_type_mismatch',
                        });
                    }
                }
            });
        });
    }

    // 7. Check for empty required cells
    csvData.forEach((row, rowIndex) => {
        requiredHeaders.forEach((header) => {
            const value = row[header];
            if (!value || value.toString().trim() === '') {
                warnings.push({
                    row: rowIndex + 2,
                    column: header,
                    message: `Required field '${header}' is empty`,
                    type: 'empty_cell',
                });
            }
        });
    });

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        data: csvData,
        headers,
    };
}

/**
 * Detects the most common data type for each column
 */
function detectColumnTypes(
    csvData: CsvTemplateRow[],
    headers: string[]
): Record<string, ColumnDataType> {
    const columnTypes: Record<string, ColumnDataType> = {};

    headers.forEach((header) => {
        const values = csvData
            .map((row) => row[header])
            .filter((value) => value !== undefined && value !== '');

        if (values.length === 0) {
            columnTypes[header] = 'unknown';
            return;
        }

        // Count type occurrences
        const typeCounts: Record<ColumnDataType, number> = {
            string: 0,
            number: 0,
            date: 0,
            unknown: 0,
        };

        values.forEach((value) => {
            if (value !== undefined) {
                const type = getValueType(value);
                typeCounts[type]++;
            }
        });

        // Find the most common type
        let maxCount = 0;
        let mostCommonType: ColumnDataType = 'unknown';

        Object.entries(typeCounts).forEach(([type, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostCommonType = type as ColumnDataType;
            }
        });

        columnTypes[header] = mostCommonType;
    });

    return columnTypes;
}

/**
 * Determines the data type of a value
 */
function getValueType(value: string | number): ColumnDataType {
    if (typeof value === 'number') {
        return 'number';
    }

    const stringValue = value.toString().trim();

    // Check if it's a number
    if (!isNaN(Number(stringValue)) && stringValue !== '') {
        return 'number';
    }

    // Check if it's a date (basic date patterns)
    const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
        /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
        /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    ];

    if (datePatterns.some((pattern) => pattern.test(stringValue))) {
        return 'date';
    }

    return 'string';
}

/**
 * Formats validation errors for display
 */
export function formatValidationError(error: CsvValidationError): string {
    const rowText = error.row > 0 ? ` (Row ${error.row})` : '';
    const columnText = error.column ? ` in ${error.column}` : '';
    return `${error.message}${columnText}${rowText}`;
}

/**
 * Formats validation warnings for display
 */
export function formatValidationWarning(warning: CsvValidationWarning): string {
    const rowText = warning.row > 0 ? ` (Row ${warning.row})` : '';
    const columnText = warning.column ? ` in ${warning.column}` : '';
    return `${warning.message}${columnText}${rowText}`;
}
