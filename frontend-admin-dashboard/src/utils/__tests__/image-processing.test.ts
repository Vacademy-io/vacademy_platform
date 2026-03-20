import {
    extractBase64Images,
    containsBase64Images,
    getBase64ImagesSize,
} from '../image-processing';

// Mock data for testing
const mockBase64Image =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==';
const mockMimeType = 'image/png';

describe('Image Processing Utils', () => {
    describe('extractBase64Images', () => {
        it('should extract base64 images from HTML', () => {
            const html = `
                <div>
                    <img src="data:${mockMimeType};base64,${mockBase64Image}" alt="test" />
                    <p>Some text</p>
                    <img src="https://example.com/image.jpg" alt="regular image" />
                </div>
            `;

            const images = extractBase64Images(html);

            expect(images).toHaveLength(1);
            const first = images[0]!;
            expect(first.mimeType).toBe(mockMimeType);
            expect(first.base64Data).toBe(mockBase64Image);
            expect(first.dataUrl).toBe(`data:${mockMimeType};base64,${mockBase64Image}`);
        });

        it('should return empty array when no base64 images found', () => {
            const html = `
                <div>
                    <img src="https://example.com/image.jpg" alt="regular image" />
                    <p>Some text</p>
                </div>
            `;

            const images = extractBase64Images(html);
            expect(images).toHaveLength(0);
        });

        it('should handle multiple base64 images', () => {
            const html = `
                <div>
                    <img src="data:image/png;base64,${mockBase64Image}" alt="test1" />
                    <img src="data:image/jpeg;base64,${mockBase64Image}" alt="test2" />
                </div>
            `;

            const images = extractBase64Images(html);
            expect(images).toHaveLength(2);
            expect(images[0]!.mimeType).toBe('image/png');
            expect(images[1]!.mimeType).toBe('image/jpeg');
        });
    });

    describe('containsBase64Images', () => {
        it('should return true when HTML contains base64 images', () => {
            const html = `<img src="data:${mockMimeType};base64,${mockBase64Image}" alt="test" />`;
            expect(containsBase64Images(html)).toBe(true);
        });

        it('should return false when HTML contains no base64 images', () => {
            const html = `<img src="https://example.com/image.jpg" alt="test" />`;
            expect(containsBase64Images(html)).toBe(false);
        });

        it('should return false for empty HTML', () => {
            expect(containsBase64Images('')).toBe(false);
        });
    });

    describe('getBase64ImagesSize', () => {
        it('should calculate approximate size of base64 images', () => {
            const html = `<img src="data:${mockMimeType};base64,${mockBase64Image}" alt="test" />`;
            const size = getBase64ImagesSize(html);

            // Base64 decoding reduces size by ~25% (4/3 ratio)
            const expectedSize = (mockBase64Image.length * 3) / 4;
            expect(size).toBe(expectedSize);
        });

        it('should return 0 for HTML with no base64 images', () => {
            const html = `<img src="https://example.com/image.jpg" alt="test" />`;
            expect(getBase64ImagesSize(html)).toBe(0);
        });

        it('should handle multiple images', () => {
            const html = `
                <img src="data:image/png;base64,${mockBase64Image}" alt="test1" />
                <img src="data:image/jpeg;base64,${mockBase64Image}" alt="test2" />
            `;
            const size = getBase64ImagesSize(html);
            const expectedSizePerImage = (mockBase64Image.length * 3) / 4;
            expect(size).toBe(expectedSizePerImage * 2);
        });
    });
});
