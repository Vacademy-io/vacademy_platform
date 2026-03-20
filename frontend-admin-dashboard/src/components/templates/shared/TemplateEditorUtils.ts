/**
 * Utility functions for template editor
 */

/**
 * Extract variables from template content
 * @param content - The template content to extract variables from
 * @returns Array of unique variables found in the content
 */
export const extractVariablesFromContent = (content: string): string[] => {
    if (!content) return [];

    // Match variables in the format {{variable_name}}
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const matches = content.match(variableRegex);

    if (!matches) return [];

    // Extract variable names and remove duplicates
    const variables = matches.map(match => match.replace(/[{}]/g, ''));
    return [...new Set(variables)];
};

/**
 * Insert a variable at the current cursor position
 * @param textarea - The textarea element
 * @param variable - The variable to insert (without curly braces)
 */
export const insertVariableAtCursor = (textarea: HTMLTextAreaElement, variable: string): void => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const variableText = `{{${variable}}}`;
    const newText = before + variableText + after;

    // Update the textarea value
    textarea.value = newText;

    // Set cursor position after the inserted variable
    const newCursorPosition = start + variableText.length;
    textarea.setSelectionRange(newCursorPosition, newCursorPosition);

    // Trigger input event to update React state
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
};

/**
 * Get cursor position in textarea
 * @param textarea - The textarea element
 * @returns Object with start and end cursor positions
 */
export const getCursorPosition = (textarea: HTMLTextAreaElement): { start: number; end: number } => {
    return {
        start: textarea.selectionStart,
        end: textarea.selectionEnd
    };
};

/**
 * Set cursor position in textarea
 * @param textarea - The textarea element
 * @param start - Start position
 * @param end - End position
 */
export const setCursorPosition = (textarea: HTMLTextAreaElement, start: number, end: number): void => {
    textarea.setSelectionRange(start, end);
    textarea.focus();
};

/**
 * Get text around cursor position
 * @param textarea - The textarea element
 * @param radius - Number of characters to include around cursor
 * @returns Object with text before, at, and after cursor
 */
export const getTextAroundCursor = (textarea: HTMLTextAreaElement, radius: number = 10): {
    before: string;
    at: string;
    after: string;
} => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;

    const beforeStart = Math.max(0, start - radius);
    const afterEnd = Math.min(text.length, end + radius);

    return {
        before: text.substring(beforeStart, start),
        at: text.substring(start, end),
        after: text.substring(end, afterEnd)
    };
};

/**
 * Replace all occurrences of a variable in content
 * @param content - The content to replace in
 * @param oldVariable - The old variable name (without curly braces)
 * @param newVariable - The new variable name (without curly braces)
 * @returns Updated content
 */
export const replaceVariable = (content: string, oldVariable: string, newVariable: string): string => {
    const oldPattern = new RegExp(`\\{\\{${oldVariable}\\}\\}`, 'g');
    return content.replace(oldPattern, `{{${newVariable}}}`);
};

/**
 * Validate variable name
 * @param variable - The variable name to validate
 * @returns True if valid, false otherwise
 */
export const isValidVariableName = (variable: string): boolean => {
    // Variable names should be alphanumeric with underscores and dots
    const variableRegex = /^[a-zA-Z][a-zA-Z0-9_.]*$/;
    return variableRegex.test(variable);
};

/**
 * Format variable for display
 * @param variable - The variable name
 * @returns Formatted variable string
 */
export const formatVariable = (variable: string): string => {
    return `{{${variable}}}`;
};

/**
 * Parse variable from formatted string
 * @param formattedVariable - The formatted variable string
 * @returns Variable name without curly braces
 */
export const parseVariable = (formattedVariable: string): string => {
    return formattedVariable.replace(/[{}]/g, '');
};
