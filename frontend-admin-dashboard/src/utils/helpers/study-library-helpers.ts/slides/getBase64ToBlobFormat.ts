// Add this helper function at the top of your file
export const base64ToFile = (base64String: string): File => {
    // Get base64 content without data URL prefix
    const base64Content = base64String.split(",")[1] || base64String;

    // Convert base64 to binary
    const binaryString = window.atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // Create blob and convert to File
    const blob = new Blob([bytes], { type: "image/jpeg" });
    return new File([blob], `image_${Date.now()}.jpg`, { type: "image/jpeg" });
};
