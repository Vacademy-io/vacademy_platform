/**
 * Formats time from milliseconds to a human-readable format
 * @param ms Time in milliseconds
 * @param format Optional format (hours, minutes, full)
 * @returns Formatted time string
 */
export const formatTimeFromMillis = (ms: number, format: 'hours' | 'minutes' | 'full' = 'full'): string => {
    if (ms === 0) return '0';
    
    // Calculate hours, minutes, seconds
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));
    
    // Return based on requested format
    switch (format) {
      case 'hours':
        return hours > 0 ? `${hours}h` : '< 1h';
      case 'minutes':
        return `${hours * 60 + minutes}m`;
      case 'full':
        if (hours > 0) {
          return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
          return `${minutes}m ${seconds}s`;
        } else {
          return `${seconds}s`;
        }
    }
  };
  
  /**
   * Converts milliseconds to decimal minutes for charting
   * @param ms Time in milliseconds
   * @returns Number of minutes (with decimal)
   */
  export const millisToMinutes = (ms: number): number => {
    return Math.round((ms / (1000 * 60)) * 10) / 10; // Round to 1 decimal place
  };