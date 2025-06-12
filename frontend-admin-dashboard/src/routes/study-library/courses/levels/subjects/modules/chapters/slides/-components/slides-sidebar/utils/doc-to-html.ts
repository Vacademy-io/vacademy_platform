import mammoth from "mammoth";

export const convertDocToHtml = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async () => {
            try {
                const arrayBuffer = reader.result as ArrayBuffer;
                const result = await mammoth.convertToHtml({ arrayBuffer });

                if (!result || !result.value) {
                    reject(new Error("Document conversion failed - no content"));
                    return;
                }

                // Add basic HTML structure if missing
                const processedHTML = `
                    <div>
                        ${result.value}
                    </div>
                `;

                // Convert to Yoopta format
                // const yooptaContent = html.deserialize(editor, processedHTML);
                resolve(processedHTML);
            } catch (error) {
                console.error("Error during conversion:", error);
                reject(error);
            }
        };

        reader.readAsArrayBuffer(file);
    });
};
