package vacademy.io.media_service.course.service.content_generation;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.net.URLConnection;
import java.util.*;

public class ExcalidrawGenerator {
    /**
     * Generates Excalidraw clipboard JSON from an image URL and a caption.
     *
     * @param imageUrl The public URL of the image to embed.
     * @param caption  The caption for the image.
     * @return A JSON string in the excalidraw/clipboard format.
     */
    public static String createExcalidrawClipboardData(String imageUrl, String caption) {
        try {
            // 1. Generate unique IDs
            String imageId = generateRandomId();
            String textId = generateRandomId();
            String fileId = generateRandomId(32); // A longer ID for the file

            // 2. Fetch the image and encode it to Base64
            URL url = new URL(imageUrl);
            URLConnection connection = url.openConnection();
            String mimeType = connection.getContentType();

            InputStream in = connection.getInputStream();
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            int nRead;
            byte[] data = new byte[1024];
            while ((nRead = in.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, nRead);
            }
            buffer.flush();
            byte[] imageBytes = buffer.toByteArray();
            String base64Image = Base64.getEncoder().encodeToString(imageBytes);
            String dataURL = "data:" + mimeType + ";base64," + base64Image;

            // 3. Create the JSON structure using Java objects
            Random rand = new Random();

            // Image Element
            Map<String, Object> imageElement = new HashMap<>();
            imageElement.put("id", imageId);
            imageElement.put("type", "image");
            imageElement.put("x", 429.1);
            imageElement.put("y", 32.4);
            imageElement.put("width", 181.4);
            imageElement.put("height", 393.4);
            imageElement.put("angle", 0);
            imageElement.put("strokeColor", "transparent");
            imageElement.put("backgroundColor", "transparent");
            imageElement.put("fillStyle", "solid");
            imageElement.put("strokeWidth", 2);
            imageElement.put("strokeStyle", "solid");
            imageElement.put("roughness", 1);
            imageElement.put("opacity", 100);
            imageElement.put("groupIds", new String[]{});
            imageElement.put("frameId", null);
            imageElement.put("index", "a2");
            imageElement.put("roundness", null);
            imageElement.put("seed", rand.nextInt());
            imageElement.put("version", 76);
            imageElement.put("versionNonce", rand.nextInt());
            imageElement.put("isDeleted", false);
            imageElement.put("boundElements", null);
            imageElement.put("updated", System.currentTimeMillis());
            imageElement.put("link", null);
            imageElement.put("locked", false);
            imageElement.put("status", "pending");
            imageElement.put("fileId", fileId);
            imageElement.put("scale", new double[]{1, 1});
            imageElement.put("crop", null);


            // Text Element (Caption)
            Map<String, Object> textElement = new HashMap<>();
            textElement.put("id", textId);
            textElement.put("type", "text");
            textElement.put("x", 490.6);
            textElement.put("y", 503.8);
            textElement.put("width", 73.3);
            textElement.put("height", 25);
            textElement.put("angle", 0);
            textElement.put("strokeColor", "#1e1e1e");
            textElement.put("backgroundColor", "transparent");
            textElement.put("fillStyle", "solid");
            textElement.put("strokeWidth", 2);
            textElement.put("strokeStyle", "solid");
            textElement.put("roughness", 1);
            textElement.put("opacity", 100);
            textElement.put("groupIds", new String[]{});
            textElement.put("frameId", null);
            textElement.put("index", "a3");
            textElement.put("roundness", null);
            textElement.put("seed", rand.nextInt());
            textElement.put("version", 39);
            textElement.put("versionNonce", rand.nextInt());
            textElement.put("isDeleted", false);
            textElement.put("boundElements", null);
            textElement.put("updated", System.currentTimeMillis());
            textElement.put("link", null);
            textElement.put("locked", false);
            textElement.put("text", caption);
            textElement.put("fontSize", 20);
            textElement.put("fontFamily", 5);
            textElement.put("textAlign", "left");
            textElement.put("verticalAlign", "top");
            textElement.put("containerId", null);
            textElement.put("originalText", caption);
            textElement.put("autoResize", true);
            textElement.put("lineHeight", 1.25);

            // Files Object
            Map<String, Object> fileData = new HashMap<>();
            fileData.put("mimeType", mimeType);
            fileData.put("id", fileId);
            fileData.put("dataURL", dataURL);
            fileData.put("created", System.currentTimeMillis());
            fileData.put("lastRetrieved", System.currentTimeMillis());

            Map<String, Object> files = new HashMap<>();
            files.put(fileId, fileData);

            // Main Clipboard Object
            Map<String, Object> clipboardData = new HashMap<>();
            clipboardData.put("type", "excalidraw/clipboard");
            clipboardData.put("elements", new Object[]{imageElement, textElement});
            clipboardData.put("files", files);

            // 4. Convert to JSON string
            Gson gson = new GsonBuilder().setPrettyPrinting().create();
            return gson.toJson(clipboardData);

        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    private static String generateRandomId() {
        return generateRandomId(21);
    }

    private static String generateRandomId(int length) {
        String id =  UUID.randomUUID().toString();
        return id.replace("-", "").substring(0, length);
    }

}
