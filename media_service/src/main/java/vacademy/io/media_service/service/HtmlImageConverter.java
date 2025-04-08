package vacademy.io.media_service.service;

import com.amazonaws.services.s3.AmazonS3;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.entity.FileMetadata;
import vacademy.io.media_service.repository.FileMetadataRepository;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.util.Base64;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;


@Service
public class HtmlImageConverter {


    private final AmazonS3 s3Client;
    private final FileMetadataRepository fileMetadataRepository;

    @Value("${aws.s3.public-bucket}")
    private String publicBucket;

    public HtmlImageConverter(AmazonS3 s3Client, FileMetadataRepository fileMetadataRepository) {
        this.s3Client = s3Client;
        this.fileMetadataRepository = fileMetadataRepository;
    }

    /**
     * Converts base64 images in the HTML string to network images hosted on S3.
     *
     * @param html The HTML string containing base64 images.
     * @return The updated HTML string with base64 images replaced by network URLs.
     * @throws IOException If an error occurs during file upload.
     */
    public String convertBase64ImagesToNetworkImages(String html) throws IOException {
        // Regex to match base64 image sources in the HTML string
        String base64ImagePattern = "<img\\s+[^>]*src\\s*=\\s*['\"]data:image\\/([^;]+);base64,([^'\"]+)['\"][^>]*>";
        Pattern pattern = Pattern.compile(base64ImagePattern);
        Matcher matcher = pattern.matcher(html);

        StringBuffer updatedHtml = new StringBuffer();

        while (matcher.find()) {
            // Extract the image format (e.g., png, jpeg) and base64 data
            String imageFormat = matcher.group(1); // e.g., "png"
            String base64Data = matcher.group(2);  // e.g., "iVBORw0KGgoAAAANSUhEUg..."

            // Upload the base64 image to S3
            String networkImageUrl = uploadBase64File(base64Data, imageFormat);

            // Replace the base64 image source with the network URL
            matcher.appendReplacement(updatedHtml, "<img src=\"" + networkImageUrl + "\"");
        }

        // Append the remaining part of the HTML string
        matcher.appendTail(updatedHtml);

        return updatedHtml.toString();
    }

    /**
     * Uploads a base64 image to S3 and returns the network URL.
     *
     * @param base64      The base64-encoded image data.
     * @param imageFormat The format of the image (e.g., "png", "jpeg").
     * @return The network URL of the uploaded image.
     * @throws IOException If an error occurs during file upload.
     */
    private String uploadBase64File(String base64, String imageFormat) throws IOException {
        // Decode the base64 string into a byte array
        byte[] fileBytes = Base64.getDecoder().decode(base64);
        if(imageFormat.equals("svg+xml"))
            imageFormat = "svg";
        imageFormat = URLEncoder.encode(imageFormat);
        // Generate a unique key for the file
        String key = "SERVICE_UPLOAD/" + UUID.randomUUID() + "." + imageFormat;

        // Create an InputStream from the byte array
        InputStream inputStream = new ByteArrayInputStream(fileBytes);

        // Upload the file to S3
        s3Client.putObject(publicBucket, key, inputStream, null);

        // Create metadata for the file
        FileMetadata metadata = new FileMetadata(
            key, // Use the key as the file name
            "image/" + imageFormat, // Set the content type (e.g., "image/png")
            key,
            "SERVICE_UPLOAD",
            "SERVICE_UPLOAD"
        );

        // Save the metadata
        fileMetadataRepository.save(metadata);

        // Return the network URL of the uploaded file
        return "https://" +  publicBucket + ".s3.amazonaws.com/" + key;
    }


    public String convertBase64ToUrls(String html) throws IOException {
        // replace base64 images in img tags with network URLs
        html = convertBase64ImagesToNetworkImages(html);
        return html;
    }


}