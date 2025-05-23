// Worker function to convert URL to base64
export async function getBase64FromUrlWorker(url: string): Promise<string> {
    // SVG handling
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
                return `data:image/svg+xml;base64,${base64}`;
            } catch (error) {
                console.error(`Failed to convert SVG to base64: ${url}`, error);
                return url;
            }
        } catch (outerError) {
            return url;
        }
    }

    // For non-SVG images, use fetch to get binary data
    try {
        const response = await fetch(`${url}?__v=${Date.now()}`, {
            credentials: "same-origin",
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Get the blob data
        const blob = await response.blob();

        // Convert to base64 using FileReader API
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => {
                console.error(`Failed to convert image to base64: ${url}`);
                reject(url);
            };
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`Failed to load image: ${url}`, error);
        return url;
    }
}

// Set up message listener
self.addEventListener("message", async (event) => {
    const { url, id } = event.data;
    try {
        const base64Url = await getBase64FromUrlWorker(url);
        self.postMessage({ id, base64Url, success: true });
    } catch (error) {
        self.postMessage({
            id,
            error: error,
            success: false,
        });
    }
});

// TypeScript requires this for workers
export {};
