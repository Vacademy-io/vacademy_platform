package vacademy.io.media_service.presentation.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class ExcalidrawElement {
    private String id;
    private String type;
    private double x;
    private double y;
    private double width;
    private double height;
    private double angle = 0;
    private String strokeColor = "#000000";
    private String backgroundColor = "transparent";
    private String fillStyle = "solid";
    private int strokeWidth = 2;
    private String strokeStyle = "solid";
    private int roughness = 1;
    private int opacity = 100;
    private int fontFamily = 6;
    private Integer fontSize = 20;
    private String textAlign = "center";
    private String verticalAlign = "middle";
    private String text;
    private String fileId;
    private String startArrowhead;
    private String endArrowhead;
    private List<List<Double>> points;
    
    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public double getX() { return x; }
    public void setX(double x) { this.x = x; }
    public double getY() { return y; }
    public void setY(double y) { this.y = y; }
    public double getWidth() { return width; }
    public void setWidth(double width) { this.width = width; }
    public double getHeight() { return height; }
    public void setHeight(double height) { this.height = height; }
    public double getAngle() { return angle; }
    public void setAngle(double angle) { this.angle = angle; }
    public String getStrokeColor() { return strokeColor; }
    public void setStrokeColor(String strokeColor) { this.strokeColor = strokeColor; }
    public String getBackgroundColor() { return backgroundColor; }
    public void setBackgroundColor(String backgroundColor) { this.backgroundColor = backgroundColor; }
    public String getFillStyle() { return fillStyle; }
    public void setFillStyle(String fillStyle) { this.fillStyle = fillStyle; }
    public int getStrokeWidth() { return strokeWidth; }
    public void setStrokeWidth(int strokeWidth) { this.strokeWidth = strokeWidth; }
    public String getStrokeStyle() { return strokeStyle; }
    public void setStrokeStyle(String strokeStyle) { this.strokeStyle = strokeStyle; }
    public int getRoughness() { return roughness; }
    public void setRoughness(int roughness) { this.roughness = roughness; }
    public int getOpacity() { return opacity; }
    public void setOpacity(int opacity) { this.opacity = opacity; }
    public int getFontFamily() { return fontFamily; }
    public void setFontFamily(int fontFamily) { this.fontFamily = fontFamily; }
    public Integer getFontSize() { return fontSize; }
    public void setFontSize(Integer fontSize) { this.fontSize = fontSize; }
    public String getTextAlign() { return textAlign; }
    public void setTextAlign(String textAlign) { this.textAlign = textAlign; }
    public String getVerticalAlign() { return verticalAlign; }
    public void setVerticalAlign(String verticalAlign) { this.verticalAlign = verticalAlign; }
    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getFileId() { return fileId; }
    public void setFileId(String fileId) { this.fileId = fileId; }
    public String getStartArrowhead() { return startArrowhead; }
    public void setStartArrowhead(String startArrowhead) { this.startArrowhead = startArrowhead; }
    public String getEndArrowhead() { return endArrowhead; }
    public void setEndArrowhead(String endArrowhead) { this.endArrowhead = endArrowhead; }
    public List<List<Double>> getPoints() { return points; }
    public void setPoints(List<List<Double>> points) { this.points = points; }
}