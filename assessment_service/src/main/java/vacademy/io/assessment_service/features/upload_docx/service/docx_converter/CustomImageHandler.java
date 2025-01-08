package vacademy.io.assessment_service.features.upload_docx.service.docx_converter;

import org.apache.batik.transcoder.TranscoderException;
import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.wmf.tosvg.WMFTranscoder;
import org.docx4j.model.images.AbstractWordXmlPicture;
import org.docx4j.model.images.ConversionImageHandler;
import org.docx4j.openpackaging.exceptions.Docx4JException;
import org.docx4j.openpackaging.parts.WordprocessingML.BinaryPart;
import org.docx4j.openpackaging.parts.WordprocessingML.MainDocumentPart;
import org.docx4j.relationships.Relationship;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;

// Custom Image Handler Class
class CustomImageHandler implements ConversionImageHandler {
    private final MainDocumentPart documentPart;

    public CustomImageHandler(MainDocumentPart documentPart) {
        this.documentPart = documentPart;
    }


    private String getImageType(String fileName) {
        if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
            return "jpeg";
        } else if (fileName.endsWith(".png")) {
            return "png";
        } else {
            return "unknown";
        }
    }

    private String convertWmfToSvg(byte[] wmfData) throws TranscoderException, IOException {
        // Convert WMF to SVG
        WMFTranscoder wmfTranscoder = new WMFTranscoder();
        ByteArrayInputStream wmfStream = new ByteArrayInputStream(wmfData);
        ByteArrayOutputStream svgStream = new ByteArrayOutputStream();
        TranscoderInput wmfInput = new TranscoderInput(wmfStream);
        TranscoderOutput svgOutput = new TranscoderOutput(svgStream);
        wmfTranscoder.transcode(wmfInput, svgOutput);
        return Base64.getEncoder().encodeToString(svgStream.toByteArray());
    }


    public String handleImage(AbstractWordXmlPicture abstractWordXmlPicture, Relationship relationship, BinaryPart binaryPart) throws Docx4JException {
        byte[] imageBytes = binaryPart.getBytes();
        String base64String = Base64.getEncoder().encodeToString(imageBytes);
        String imageType = getImageType(binaryPart.getPartName().getName());

        if (imageType.equals("wmf") || imageType.equals("emf")) {
            try {
                base64String = convertWmfToSvg(imageBytes);
            } catch (TranscoderException e) {
                throw new RuntimeException(e);
            } catch (IOException e) {
                throw new RuntimeException(e);
            }
            return "<img src=\"data:image/svg+xml;base64," + base64String + "\" />";
        } else {
            return "<img src=\"data:image/" + imageType + ";base64," + base64String + "\" />";
        }
    }

}
