import { useFileUpload } from "@/hooks/use-file-upload";
import { base64ToFile } from "./getBase64ToBlobFormat";

export function useReplaceBase64ImagesWithNetworkUrls() {
    const { uploadFile, getPublicUrl } = useFileUpload();
    const replaceImages = async (htmlContent: string): Promise<string> => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");
        const images = doc.getElementsByTagName("img");

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            // Early continue if img is undefined
            if (!img) continue;

            const src = img.getAttribute("src");

            if (src && src.startsWith("data:image")) {
                try {
                    const file = base64ToFile(src);
                    const uploadedFileId = await uploadFile({
                        file,
                        setIsUploading: () => {},
                        userId: "your-user-id",
                        source: "YOUR_SOURCE",
                        sourceId: "YOUR_SOURCE_ID",
                        publicUrl: true,
                    });

                    if (uploadedFileId) {
                        const publicUrl = await getPublicUrl(uploadedFileId);

                        // Create wrapper div
                        const wrapperDiv = document.createElement("div");
                        wrapperDiv.setAttribute(
                            "style",
                            "margin-left: 0px; display: flex; width: 100%; justify-content: center;",
                        );

                        // Create new image element with proper casing for objectFit
                        const newImg = document.createElement("img");
                        newImg.setAttribute("src", publicUrl);
                        newImg.setAttribute("data-meta-align", "center");
                        newImg.setAttribute("data-meta-depth", "0");
                        newImg.setAttribute("alt", file.name || "image");
                        newImg.setAttribute("width", "0");
                        newImg.setAttribute("height", "0");
                        newImg.setAttribute("objectFit", "contain");

                        // Add image to wrapper
                        wrapperDiv.appendChild(newImg);

                        // Replace old image with wrapped new one
                        const paragraph = img.parentNode;
                        if (paragraph) {
                            paragraph.replaceChild(wrapperDiv, img);
                        }
                    }
                } catch (error) {
                    console.error("Error processing image:", error);
                }
            }
        }

        let updatedHtml = doc.documentElement.outerHTML;
        updatedHtml = updatedHtml.replace(/&amp;/g, "&");

        return updatedHtml;
    };

    return replaceImages;
}
