# Image Processing Solution for DOC Editor

## Problem

When users paste images into the DOC editor (YooptaEditor), the images are embedded as base64 data URLs directly in the HTML content. This causes the HTTP request payload to become extremely large, leading to `413 Request Entity Too Large` errors when saving slides.

### Example Error
```
<html>
<head><title>413 Request Entity Too Large</title></head>
<body>
<center><h1>413 Request Entity Too Large</h1></center>
<hr><center>nginx</center>
</body>
```

## Solution

We implemented an automatic image processing system that:

1. **Detects base64 images** in HTML content before saving
2. **Extracts and uploads** base64 images to S3 storage
3. **Replaces base64 data URLs** with S3 public URLs
4. **Saves the processed HTML** with much smaller payload size

## Implementation

### Core Utilities (`src/utils/image-processing.ts`)

#### `extractBase64Images(html: string)`
- Parses HTML to find all base64 image data URLs
- Returns array of image objects with metadata

#### `processHtmlImages(html: string)`
- Main processing function that handles the entire workflow
- Uploads base64 images to S3 and replaces URLs in HTML
- Returns processed HTML and upload statistics

#### `containsBase64Images(html: string)`
- Quick check to determine if HTML contains base64 images
- Used for optimization to skip processing when not needed

#### `getBase64ImagesSize(html: string)`
- Calculates approximate size of base64 images in bytes
- Useful for logging and debugging

### Integration Points

The image processing is integrated into three key save flows:

1. **Auto-publish for non-admin users** (`autoPublishDocSlide`)
2. **Manual save draft** (`SaveDraft`)
3. **Unsaved changes prompt** (admin modal)

### Flow Diagram

```
User pastes image in DOC editor
           ↓
Image embedded as base64 in HTML
           ↓
User saves slide
           ↓
System detects base64 images
           ↓
Extract base64 data and metadata
           ↓
Convert to File objects
           ↓
Upload to S3 storage
           ↓
Get public URLs
           ↓
Replace base64 URLs with S3 URLs
           ↓
Save processed HTML to backend
```

## Usage Examples

### Before (Problematic)
```html
<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABP0AAAM3CAYAAABGdyUxAAAQAElEQVR4Acz9ybMl15XuiX2fnxsA2KELANEjAn2SBAj2ySbZgF0mM5NNq9epyeTaqCyslJJI0kmKzPNaqLBG0mmif7Eqnwk4h5f+n1ru5/j98a9gY75TB7++erXXnvt7X7O8QiC0ytvfrNee/s79aV3vl9f/voPG69/48f1le+8X29+7xf1xvd+Xm/8JfT7v6rXf/Drxhs/+pt6+6e/rXd//g/1tZ/+od5Z8O7P/qHe/dkf6uvvH/Hez/9QK77xyz/UN375+/rmr/7QeO9XxP/qH+urv34QX0MffPWX+IB3kN/95T9W8PVf/VO9B74Bvv3rf6rv/vU/1ff+5p+bfodckf/yb/9t/eB3/7G+93f/rv7yt/+hfvD7/9T43m//Y33vt/+pvv2bf1/f/PW/ZS7/VF97/x+Y1+/qrR//Xc/zy8z/y9/5aX3xvR/Wq299u1784jt17+U36+691+v2rb+oO9dfrpeuvVSvPPdCvXzthXoB3L3+Yt2+/kLdvPFCXb/xYj13/V49F3rzpbp26+W6fuuVun7z1caN66/U3Wuv1gvPDdyDRr6D/g65b994uW7ffrVu3wHPv1q37r5aN++9WtfvkePey3Xt7kv1LHQg/Iv13L0X0b9Y1+++UDeev1c37zxft27fqdu3b9edO3fq+Tu3697z4M6dugf/PLo7t+/WnVvP152bd+rODXD9dt2+FtypW8/..." alt="Large base64 image" />
```

### After (Optimized)
```html
<img src="https://backend-stage.vacademy.io/s3/public/doc-image-1642345678901-abc123def456.png" alt="Large base64 image" />
```

## Error Handling

The system includes comprehensive error handling:

- **Failed uploads**: Continue processing other images, show warning toast
- **Network errors**: Graceful degradation, user feedback
- **Invalid base64**: Skip problematic images, log errors
- **Missing credentials**: Skip processing, return original HTML

## Performance Considerations

- **Debounced processing**: Only processes when actually saving
- **Size optimization**: Significantly reduces payload size
- **Parallel uploads**: Multiple images uploaded concurrently
- **Caching**: S3 URLs are cached for better performance

## Testing

Unit tests are provided in `src/utils/__tests__/image-processing.test.ts` covering:

- Base64 image extraction
- HTML content detection
- Size calculation
- Edge cases and error scenarios

## Monitoring

The system provides detailed logging:

```javascript
console.log('Processing base64 images in DOC content...');
console.log(`Base64 images size: ${Math.round(imageSize / 1024)}KB`);
console.log(`Successfully processed ${uploadedImages} images`);
```

## User Experience

- **Progress indication**: Users see processing status
- **Success feedback**: Toast notifications for successful uploads
- **Error feedback**: Clear error messages for failed uploads
- **Transparent operation**: Automatic processing without user intervention

## Future Enhancements

1. **Batch optimization**: Process multiple slides at once
2. **Image compression**: Reduce image file sizes before upload
3. **Format conversion**: Convert to optimal formats (WebP, etc.)
4. **Retry mechanism**: Automatic retry for failed uploads
5. **Progress bars**: Detailed upload progress for large images
