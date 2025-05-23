export function parseHtmlToString(html: string) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || doc.body.innerText || "";
}

export function extractImagesFromHtml(html: string) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const images = Array.from(doc.body.querySelectorAll("img")).map((img) => img);
    return images;
}

/**
 * Processes an HTML string and extracts its content and images
 * @param htmlString The HTML string to process
 * @returns An array of content items (text or image)
 */
export function processHtmlString(html: string | undefined) {
    if (!html) return [{ type: "text", content: "" }];

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const result: { type: string; content: string }[] = [];

    // Helper function to process nodes recursively
    function processNode(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
                result.push({ type: "text", content: text });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;

            // Handle images
            if (element.tagName === "IMG") {
                const src = element.getAttribute("src");
                if (src) {
                    result.push({ type: "image", content: src });
                }
            }
            // Handle KaTeX/math formula spans
            else if (
                element.classList.contains("ql-formula") ||
                element.querySelector(".katex, .katex-html, .katex-mathml")
            ) {
                // Preserve the entire formula HTML
                result.push({
                    type: "formula",
                    content: element.outerHTML,
                });
            }
            // Process children recursively for other elements
            else {
                for (const child of Array.from(element.childNodes)) {
                    processNode(child);
                }
            }
        }
    }

    // Process all body children
    for (const child of Array.from(doc.body.childNodes)) {
        processNode(child);
    }

    return result;
}

export function makeid() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < 5; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

// Worker management
let imageWorker: Worker | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<number, (value: string) => void>();

// Initialize the worker once
function getImageWorker() {
    if (!imageWorker && typeof Worker !== "undefined") {
        try {
            imageWorker = new Worker(
                new URL("../../../../worker/image-worker.ts", import.meta.url),
                {
                    type: "module",
                },
            );
            imageWorker.onmessage = (event) => {
                const { id, base64Url } = event.data;
                const resolve = pendingRequests.get(id);
                if (resolve) {
                    resolve(base64Url);
                    pendingRequests.delete(id);
                }
            };

            imageWorker.onerror = (error) => {
                console.error("Worker error:", error);
            };
        } catch (error) {
            console.error("Failed to create image worker:", error);
            imageWorker = null;
        }
    }
    return imageWorker;
}

// Add a cache for base64 conversions
const base64Cache = new Map<string, string>();

export async function getBase64FromUrl(url: string) {
    // Check cache first
    if (base64Cache.has(url)) {
        console.log("return from cachec");
        return base64Cache.get(url);
    }

    // Try to use the worker for all image conversions
    const worker = getImageWorker();

    if (worker) {
        try {
            const id = nextRequestId++;
            const workerPromise = new Promise<string>((resolve, reject) => {
                // Add a timeout to prevent hanging requests
                const timeoutId = setTimeout(() => {
                    pendingRequests.delete(id);
                    reject(new Error("Worker timeout"));
                }, 10000); // 10 seconds timeout

                pendingRequests.set(id, (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                });

                worker.postMessage({ url, id });
            });

            // Wait for the worker to complete
            try {
                const result = await workerPromise;
                base64Cache.set(url, result);
                return result;
            } catch (error) {
                console.warn(`Worker failed for ${url}:`, error);
                // Fall through to the fallback implementation
            }
        } catch (error) {
            console.error("Worker communication failed:", error);
            // Fall through to the fallback implementation
        }
    }

    // Fallback implementation (original code)
    // Check if the URL is an SVG
    if (url.toLowerCase().endsWith(".svg")) {
        try {
            const requestOptions: RequestInit = {
                method: "GET",
                mode: "cors",
                cache: "no-cache",
                credentials: "same-origin",
                redirect: "follow",
            };

            // Timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            requestOptions.signal = controller.signal;

            try {
                const response = await fetch(url, requestOptions);
                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
                }

                const svgText = await response.text();

                const base64 = btoa(unescape(encodeURIComponent(svgText)));
                const result = `data:image/svg+xml;base64,${base64}`;
                base64Cache.set(url, result);
                return result;
            } catch (error) {
                console.error(`Failed to convert SVG to base64: ${url}`, error);
                return url;
            }
        } catch (outerError) {
            return url;
        }
    }

    // Existing non-SVG image handling
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `${url}?__v=${Date.now()}`;
    return new Promise((resolve) => {
        img.onload = function () {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0);
            const base64String = canvas.toDataURL("image/png");
            base64Cache.set(url, base64String);
            resolve(base64String);
        };
        img.onerror = function () {
            console.error(`Failed to load image: ${url}`);
            resolve(url);
        };
    });
}
