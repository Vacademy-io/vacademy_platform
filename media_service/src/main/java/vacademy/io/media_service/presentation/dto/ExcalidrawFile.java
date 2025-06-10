package vacademy.io.media_service.presentation.dto;

public class ExcalidrawFile {
    public String mimeType;
    public String id;
    public String dataURL;
    public long created = System.currentTimeMillis();

    public ExcalidrawFile(String mimeType, String id, String dataURL) {
        this.mimeType = mimeType;
        this.id = id;
        this.dataURL = dataURL;
    }
}