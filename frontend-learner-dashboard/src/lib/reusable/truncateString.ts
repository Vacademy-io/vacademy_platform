/**
 * Truncates a string to a specified length and adds an ellipsis
 * @param text - The string to truncate
 * @param maxLength - Maximum length of the string before truncation
 * @param ellipsis - Custom ellipsis string (defaults to "...")
 * @returns Truncated string with ellipsis if necessary
 */
export const truncateString = (
    text: string,
    maxLength: number,
    ellipsis: string = "...",
): string => {
    // Handle edge cases
    if (!text) return "";
    if (maxLength <= 0) return "";
    if (text.length <= maxLength) return text;
    if (maxLength <= ellipsis.length) return ellipsis.slice(0, maxLength);

    // Calculate where to cut the string to accommodate the ellipsis
    const truncateLength = maxLength - ellipsis.length;

    // Find the last space within the truncate length to avoid cutting words in middle
    const lastSpace = text.slice(0, truncateLength + 1).lastIndexOf(" ");

    // If there's a space in the truncated portion, cut at the last space
    if (lastSpace > 0) {
        return text.slice(0, lastSpace) + ellipsis;
    }

    // If no space found or very short text, just cut at truncateLength
    return text.slice(0, truncateLength) + ellipsis;
};
