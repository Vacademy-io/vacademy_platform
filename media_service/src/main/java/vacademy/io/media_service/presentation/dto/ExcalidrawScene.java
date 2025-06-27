package vacademy.io.media_service.presentation.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;



public class ExcalidrawScene {
    public String id;
    public String type = "excalidraw";
    public int slide_order;
    public List<ExcalidrawElement> elements;
    @Getter
    public AppState appState = new AppState();
    public Map<String, ExcalidrawFile> files;

    public ExcalidrawScene(String id, int slide_order, List<ExcalidrawElement> elements, Map<String, ExcalidrawFile> files) {
        this.id = id;
        this.slide_order = slide_order;
        this.elements = elements;
        this.files = files;
    }

}