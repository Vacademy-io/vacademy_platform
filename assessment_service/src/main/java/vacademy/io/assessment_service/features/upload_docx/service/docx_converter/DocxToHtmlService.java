package vacademy.io.assessment_service.features.upload_docx.service.docx_converter;

import org.apache.batik.transcoder.TranscoderException;
import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.wmf.tosvg.WMFTranscoder;

import org.docx4j.convert.out.HTMLSettings;
import org.docx4j.openpackaging.contenttype.ContentType;
import org.docx4j.openpackaging.packages.WordprocessingMLPackage;
import org.docx4j.openpackaging.parts.WordprocessingML.BinaryPart;
import org.docx4j.openpackaging.parts.WordprocessingML.BinaryPartAbstractImage;
import org.docx4j.openpackaging.parts.WordprocessingML.MainDocumentPart;
import org.springframework.stereotype.Service;

import java.io.*;
import java.util.Base64;

import org.docx4j.Docx4J;

@Service
public class DocxToHtmlService {

    public static String convertDocxToHtml(File docxFile) throws Exception {
        // Create a new WordprocessingMLPackage object
        WordprocessingMLPackage wordMLPackage = WordprocessingMLPackage.load(new FileInputStream(docxFile));
        // Convert and update images
        for (Object part : wordMLPackage.getParts().getParts().values()) {
            if (part instanceof BinaryPart) {
                BinaryPart binaryPart = (BinaryPart) part;
                if (binaryPart.getContentType().equals("image/x-wmf")) {
                    byte[] svgData = convertWmfToSvgBytes(binaryPart.getBytes());
                    updateImagePart(binaryPart, svgData, "image/svg+xml");
                } else if (binaryPart.getContentType().equals("image/x-emf")) {
                    byte[] svgData = convertWmfToSvgBytes(binaryPart.getBytes()); // Assuming the same method can handle EMF
                    updateImagePart(binaryPart, svgData, "image/svg+xml");
                }
            }
        }

        MainDocumentPart documentPart = wordMLPackage.getMainDocumentPart();


        // Create HTML settings
        HTMLSettings htmlSettings = new HTMLSettings();
        htmlSettings.setImageHandler(new CustomImageHandler(documentPart));
        htmlSettings.setOpcPackage(wordMLPackage);

        // Convert DOCX to HTML
        OutputStream outputStream = new ByteArrayOutputStream();
        Docx4J.toHTML(htmlSettings, outputStream, Docx4J.FLAG_EXPORT_PREFER_XSL);
        outputStream.flush();
        String html = outputStream.toString();
        outputStream.close();
        return html;
    }

    private static void updateImagePart(BinaryPart binaryPart, byte[] newData, String newContentType) {
        BinaryPartAbstractImage imagePart = (BinaryPartAbstractImage) binaryPart;
        imagePart.setBinaryData(newData);
        imagePart.setContentType(new ContentType(newContentType));
    }


    // Helper method to convert WMF to PNG
    private static String convertWmfToSvg(byte[] wmfData) throws TranscoderException, IOException {
        // Convert WMF to SVG
        WMFTranscoder wmfTranscoder = new WMFTranscoder();
        ByteArrayInputStream wmfStream = new ByteArrayInputStream(wmfData);
        ByteArrayOutputStream svgStream = new ByteArrayOutputStream();
        TranscoderInput wmfInput = new TranscoderInput(wmfStream);
        TranscoderOutput svgOutput = new TranscoderOutput(svgStream);
        wmfTranscoder.transcode(wmfInput, svgOutput);
        return Base64.getEncoder().encodeToString(svgStream.toByteArray());
    }


    private static byte[] convertWmfToSvgBytes(byte[] wmfData) throws TranscoderException, IOException {
        // Convert WMF to SVG
        WMFTranscoder wmfTranscoder = new WMFTranscoder();
        ByteArrayInputStream wmfStream = new ByteArrayInputStream(wmfData);
        ByteArrayOutputStream svgStream = new ByteArrayOutputStream();
        TranscoderInput wmfInput = new TranscoderInput(wmfStream);
        TranscoderOutput svgOutput = new TranscoderOutput(svgStream);
        wmfTranscoder.transcode(wmfInput, svgOutput);
        return (svgStream.toByteArray());
    }

    private static String getImageType(String fileName) {
        if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
            return "jpeg";
        } else if (fileName.endsWith(".png")) {
            return "png";
        } else {
            return "unknown";
        }
    }
}