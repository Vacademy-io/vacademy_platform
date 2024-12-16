package vacademy.io.assessment_service.features.upload_docx.service.docx_converter;

import org.docx4j.model.images.AbstractWordXmlPicture;
import org.docx4j.model.images.ConversionImageHandler;
import org.docx4j.openpackaging.exceptions.Docx4JException;
import org.docx4j.openpackaging.parts.WordprocessingML.BinaryPart;
import org.docx4j.openpackaging.parts.WordprocessingML.BinaryPartAbstractImage;
import org.docx4j.relationships.Relationship;

import java.io.OutputStream;

public class CustomConversionImageHandler implements ConversionImageHandler {

    @Override
    public String handleImage(AbstractWordXmlPicture abstractWordXmlPicture, Relationship relationship, BinaryPart binaryPart) throws Docx4JException {
        return "img";
    }
}