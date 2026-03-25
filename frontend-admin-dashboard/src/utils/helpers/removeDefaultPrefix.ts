/**
 * Removes "default" prefix from a string (case-insensitive)
 * @param text - The text to process
 * @returns Text without "default" prefix
 * @example
 * removeDefaultPrefix("default Science ") // "Science"
 * removeDefaultPrefix("Default Practice") // "Practice"
 * removeDefaultPrefix("Vet Course") // "Vet Course"
 */
export const removeDefaultPrefix = (text: string): string => {
    return text.replace(/^default\s+/i, '').trim();
};
