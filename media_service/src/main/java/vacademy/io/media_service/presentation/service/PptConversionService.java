package vacademy.io.media_service.presentation.service;

import org.apache.poi.hslf.usermodel.HSLFSlideShow;
import org.apache.poi.sl.usermodel.*;
import org.apache.poi.sl.usermodel.Shape;
import org.apache.poi.xslf.usermodel.XMLSlideShow;
import org.springframework.stereotype.Service;
import vacademy.io.media_service.presentation.dto.ExcalidrawElement;
import vacademy.io.media_service.presentation.dto.ExcalidrawFile;
import vacademy.io.media_service.presentation.dto.ExcalidrawScene;

import java.awt.Color;
import java.awt.geom.Rectangle2D;
import java.io.InputStream;
import java.util.*;

import java.util.List;

import java.awt.Dimension;


@Service
public class PptConversionService {

    /**
     * Converts a PowerPoint file into a list of ExcalidrawScene objects.
     *
     * @param inputStream The input stream of the PowerPoint file.
     * @param filename    The name of the file to determine its type.
     * @return A list of ExcalidrawScene objects.
     * @throws Exception if an error occurs during processing.
     */
    public List<ExcalidrawScene> convertPptToExcalidraw(InputStream inputStream, String filename) throws Exception {
        SlideShow<?, ?> slideShow;
        if (filename != null && filename.toLowerCase().endsWith(".pptx")) {
            slideShow = new XMLSlideShow(inputStream);
        } else {
            slideShow = new HSLFSlideShow(inputStream);
        }

        List<ExcalidrawScene> excalidrawScenes = new ArrayList<>();
        int slideOrder = 1;

        Dimension pageSize = slideShow.getPageSize();
        double slideWidth = pageSize.getWidth();
        double slideHeight = pageSize.getHeight();

        for (Slide<?, ?> slide : slideShow.getSlides()) {
            List<ExcalidrawElement> elements = new ArrayList<>();
            Map<String, ExcalidrawFile> files = new HashMap<>();

            // --- Get Slide Background Color ---
            String backgroundColor = "#ffffff"; // Default to white
            Background<?,?> background = slide.getBackground();
            if (background != null) {
                PaintStyle fill = background.getFillStyle().getPaint();
                if (fill instanceof PaintStyle.SolidPaint) {
                    Color color = ((PaintStyle.SolidPaint) fill).getSolidColor().getColor();
                    backgroundColor = colorToHex(color);
                }
            }
            // --- End Background Color Logic ---

            for (Shape<?, ?> shape : slide.getShapes()) {
                elements.addAll(convertShapeToExcalidrawElements(shape, slideWidth, slideHeight, files));
            }

            ExcalidrawScene scene = new ExcalidrawScene(
                    "temp-" + System.currentTimeMillis() + "-" + Math.random(),
                    slideOrder++,
                    elements,
                    files
            );

            // Set the extracted background color on the scene's appState
            scene.getAppState().setViewBackgroundColor(backgroundColor);

            excalidrawScenes.add(scene);
        }

        slideShow.close();
        return excalidrawScenes;
    }
    /**
     * Converts a single PowerPoint Shape into a list of ExcalidrawElements.
     * A single shape (like a table or group) can result in multiple Excalidraw elements.
     *
     * @return A list of corresponding ExcalidrawElements.
     */
    private List<ExcalidrawElement> convertShapeToExcalidrawElements(Shape<?, ?> shape, double slideWidth, double slideHeight, Map<String, ExcalidrawFile> files) {
        String elementId = shape.getShapeName().toLowerCase(Locale.ROOT).replace(" ", "_") + "_" + shape.getShapeId();
        List<ExcalidrawElement> elements = new ArrayList<>();

        if (shape instanceof GroupShape) {
            return processGroupShape((GroupShape<?, ?>) shape, slideWidth, slideHeight, files);
        }

        Rectangle2D anchor = shape.getAnchor();
        double x = anchor.getX() - slideWidth / 2;
        double y = anchor.getY() - slideHeight / 2;
        double width = anchor.getWidth();
        double height = anchor.getHeight();

        // --- KEY CHANGE STARTS HERE ---
        // Handle AutoShapes, which can contain both a visual shape and text.
        if (shape instanceof AutoShape) {
            AutoShape<?, ?> autoShape = (AutoShape<?, ?>) shape;

            // 1. Create the visual shape element (rectangle, ellipse, etc.).
            elements.add(createAutoShapeElement(autoShape, x, y, width, height, elementId + "_shape"));

            // 2. If there is text, create a separate text element on top.
            String text = getFullTextFromShape(autoShape);
            if (text != null && !text.trim().isEmpty()) {
                elements.add(createTextElement(autoShape, x, y, width, height, elementId + "_text"));
            }
            return elements;
        }
        // Handle pure text boxes (no visible container shape)
        else if (shape instanceof TextShape) {
            elements.add(createTextElement((TextShape<?, ?>) shape, x, y, width, height, elementId));
        }
        // Handle other specific shape types
        else if (shape instanceof ConnectorShape) {
            elements.add(createConnectorElement((ConnectorShape<?, ?>) shape, x, y, width, height, elementId));
        } else if (shape instanceof PictureShape) {
            elements.add(createImageElement((PictureShape<?, ?>) shape, x, y, width, height, elementId, files));
        } else if (shape instanceof TableShape) {
            elements.addAll(createTableElements((TableShape<?, ?>) shape, slideWidth, slideHeight, elementId));
        }

        return elements;
    }


    /**
     * Recursively processes shapes within a group.
     */
    private List<ExcalidrawElement> processGroupShape(GroupShape<?, ?> group, double slideWidth, double slideHeight, Map<String, ExcalidrawFile> files) {
        List<ExcalidrawElement> elements = new ArrayList<>();
        for (Shape<?, ?> shape : group) {
            elements.addAll(convertShapeToExcalidrawElements(shape, slideWidth, slideHeight, files));
        }
        return elements;
    }

    /**
     * Creates an Excalidraw image element and populates the files map with Base64 data.
     */
    private ExcalidrawElement createImageElement(PictureShape<?, ?> pictureShape, double x, double y, double width, double height, String id, Map<String, ExcalidrawFile> files) {
        PictureData picData = pictureShape.getPictureData();
        byte[] data = picData.getData();
        String mimeType = picData.getContentType();
        if (mimeType == null) {
            mimeType = "image/png"; // Default fallback
        }
        String base64Data = Base64.getEncoder().encodeToString(data);
        String dataURL = "data:" + mimeType + ";base64," + base64Data;

        String fileId = "file-" + UUID.randomUUID().toString();

        ExcalidrawFile excalidrawFile = new ExcalidrawFile(mimeType, fileId, dataURL);
        files.put(fileId, excalidrawFile);

        ExcalidrawElement element = new ExcalidrawElement();
        element.setId(id);
        element.setType("image");
        element.setFileId(fileId);
        element.setX(x);
        element.setY(y);
        element.setWidth(width);
        element.setHeight(height);
        return element;
    }

    /**
     * Deconstructs a PowerPoint table into multiple rectangle and text elements.
     */
    private List<ExcalidrawElement> createTableElements(TableShape<?, ?> table, double slideWidth, double slideHeight, String baseId) {
        List<ExcalidrawElement> elements = new ArrayList<>();
        Rectangle2D tableAnchor = table.getAnchor();

        for (int i = 0; i < table.getNumberOfRows(); i++) {
            for (int j = 0; j < table.getNumberOfColumns(); j++) {
                TableCell<?, ?> cell = table.getCell(i, j);
                if (cell == null || (cell.getGridSpan() > 1 && j > 0 && table.getCell(i, j - 1) != null && table.getCell(i, j - 1).getGridSpan() > 1) || (cell.getRowSpan() > 1 && i > 0 && table.getCell(i - 1, j) != null && table.getCell(i - 1, j).getRowSpan() > 1)) {
                    continue; // Skip processing for cells that are part of a merge
                }

                Rectangle2D cellAnchor = cell.getAnchor();
                double cellAbsX = tableAnchor.getX() + cellAnchor.getX();
                double cellAbsY = tableAnchor.getY() + cellAnchor.getY();
                double cellCenterX = cellAbsX - slideWidth / 2;
                double cellCenterY = cellAbsY - slideHeight / 2;
                double cellWidth = cellAnchor.getWidth() * cell.getGridSpan();
                double cellHeight = cellAnchor.getHeight() * cell.getRowSpan();

                ExcalidrawElement cellRect = new ExcalidrawElement();
                cellRect.setId(baseId + "_cell_" + i + "_" + j);
                cellRect.setType("rectangle");
                cellRect.setX(cellCenterX);
                cellRect.setY(cellCenterY);
                cellRect.setWidth(cellWidth);
                cellRect.setHeight(cellHeight);

                PaintStyle cellFill = cell.getFillStyle().getPaint();
                if (cellFill instanceof PaintStyle.SolidPaint) {
                    cellRect.setBackgroundColor(colorToHex(((PaintStyle.SolidPaint) cellFill).getSolidColor().getColor()));
                } else {
                    cellRect.setBackgroundColor("transparent");
                }

                StrokeStyle border = cell.getBorderStyle(TableCell.BorderEdge.top);
                if (border != null) {

                    if (border.getPaint() instanceof PaintStyle.SolidPaint) {
                        cellRect.setStrokeColor(colorToHex(((PaintStyle.SolidPaint) border).getSolidColor().getColor()));
                    } else {
                        cellRect.setStrokeColor("#000000");
                    }
                    cellRect.setStrokeWidth((int) border.getLineWidth());
                } else {
                    cellRect.setStrokeColor("#000000");
                    cellRect.setStrokeWidth(1);
                }
                elements.add(cellRect);

                String cellTextContent = getFullTextFromShape(cell);
                if (!cellTextContent.isEmpty()) {
                    ExcalidrawElement cellText = createTextElement(cell, cellCenterX, cellCenterY, cellWidth, cellHeight, baseId + "_text_" + i + "_" + j);
                    elements.add(cellText);
                }
            }
        }
        return elements;
    }

    private String getFullTextFromShape(TextShape<?, ?> textShape) {
        StringBuilder textBuilder = new StringBuilder();
        for (TextParagraph<?, ?, ?> paragraph : textShape.getTextParagraphs()) {
            for (TextRun run : paragraph.getTextRuns()) {
                textBuilder.append(run.getRawText());
            }
            textBuilder.append("\n");
        }
        if (textBuilder.length() > 0) {
            textBuilder.setLength(textBuilder.length() - 1);
        }
        return textBuilder.toString();
    }


    private ExcalidrawElement createTextElement(TextShape<?, ?> textShape, double x, double y, double width, double height, String id) {
        ExcalidrawElement element = new ExcalidrawElement();
        element.setId(id);
        element.setType("text");
        element.setX(x);
        element.setY(y);
        element.setWidth(width);
        element.setHeight(height);

        element.setText(getFullTextFromShape(textShape));
        element.setBackgroundColor("transparent");

        if (!textShape.getTextParagraphs().isEmpty() && !textShape.getTextParagraphs().get(0).getTextRuns().isEmpty()) {
            TextRun textRun = textShape.getTextParagraphs().get(0).getTextRuns().get(0);
            element.setFontSize(textRun.getFontSize() != null ? textRun.getFontSize().intValue() : 18);

            PaintStyle fontColor = textRun.getFontColor();
            if (fontColor instanceof PaintStyle.SolidPaint) {
                String hexColor = colorToHex(((PaintStyle.SolidPaint) fontColor).getSolidColor().getColor());

                // --- KEY CHANGE HERE ---
                // If the text color is white, default to black for visibility on the canvas.
                if ("#ffffff".equalsIgnoreCase(hexColor)) {
                    element.setStrokeColor("#000000");
                } else {
                    element.setStrokeColor(hexColor);
                }
            } else {
                element.setStrokeColor("#000000");
            }

            TextParagraph.TextAlign align = textShape.getTextParagraphs().get(0).getTextAlign();
            if (align != null) {
                switch (align) {
                    case LEFT:
                        element.setTextAlign("left");
                        break;
                    case CENTER:
                        element.setTextAlign("center");
                        break;
                    case RIGHT:
                        element.setTextAlign("right");
                        break;
                    case JUSTIFY:
                        element.setTextAlign("justify");
                        break;
                }
            } else {
                element.setTextAlign("left");
            }
        } else {
            element.setFontSize(18);
            element.setStrokeColor("#000000");
            element.setTextAlign("left");
        }
        element.setVerticalAlign(getVerticalAlignment(textShape.getVerticalAlignment()));
        return element;
    }

    private ExcalidrawElement createAutoShapeElement(AutoShape<?, ?> autoShape, double x, double y, double width, double height, String id) {
        ExcalidrawElement element = createTextElement(autoShape, x, y, width, height, id);

        ShapeType shapeType = autoShape.getShapeType(); // Get shape type once to avoid multiple calls

        // Add a null check to prevent NullPointerException
        if (shapeType != null) {
            switch (shapeType) {
                case RECT:
                case ROUND_RECT:
                    element.setType("rectangle");
                    break;
                case ELLIPSE:
                    element.setType("ellipse");
                    break;
                case DIAMOND:
                    element.setType("diamond");
                    break;
                default:
                    element.setType("rectangle");
                    break;
            }
        } else {
            // If shapeType is null, default to a rectangle
            element.setType("rectangle");
        }

        PaintStyle fillPaint = autoShape.getFillStyle().getPaint();
        if (fillPaint instanceof PaintStyle.SolidPaint) {
            element.setBackgroundColor(colorToHex(((PaintStyle.SolidPaint) fillPaint).getSolidColor().getColor()));
        } else {
            element.setBackgroundColor("transparent");
        }

        PaintStyle linePaint = autoShape.getStrokeStyle().getPaint();
        if (linePaint instanceof PaintStyle.SolidPaint) {
            element.setStrokeColor(colorToHex(((PaintStyle.SolidPaint) linePaint).getSolidColor().getColor()));
            element.setStrokeWidth((int) autoShape.getStrokeStyle().getLineWidth());
        } else {
            // If there's no line, make it fully transparent.
            element.setStrokeColor("transparent");
            element.setStrokeWidth(0);
        }

        return element;
    }

    private ExcalidrawElement createConnectorElement(ConnectorShape<?, ?> connector, double x, double y, double width, double height, String id) {
        ExcalidrawElement element = new ExcalidrawElement();
        element.setId(id);
        element.setType("arrow");
        element.setX(x);
        element.setY(y);
        element.setWidth(width);
        element.setHeight(height);
        element.setPoints(Arrays.asList(Arrays.asList(0.0, 0.0), Arrays.asList(width, height)));

        PaintStyle linePaint = connector.getStrokeStyle().getPaint();
        if (linePaint instanceof PaintStyle.SolidPaint) {
            element.setStrokeColor(colorToHex(((PaintStyle.SolidPaint) linePaint).getSolidColor().getColor()));
        } else {
            element.setStrokeColor("#868e96");
        }

        if (connector.getLineDecoration().getHeadShape() != LineDecoration.DecorationShape.NONE) {
            element.setStartArrowhead("arrow");
        }
        if (connector.getLineDecoration().getTailShape() != LineDecoration.DecorationShape.NONE) {
            element.setEndArrowhead("arrow");
        }
        return element;
    }

    private String colorToHex(Color color) {
        if (color == null) return "#000000";
        return String.format("#%02x%02x%02x", color.getRed(), color.getGreen(), color.getBlue());
    }

    private String getVerticalAlignment(VerticalAlignment alignment) {
        if (alignment == null) return "middle";
        switch (alignment) {
            case TOP:
                return "top";
            case MIDDLE:
                return "middle";
            case BOTTOM:
                return "bottom";
            default:
                return "middle";
        }
    }
}