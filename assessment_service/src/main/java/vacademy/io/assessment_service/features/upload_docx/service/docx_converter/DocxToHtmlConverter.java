package vacademy.io.assessment_service.features.upload_docx.service.docx_converter;

import org.apache.poi.xwpf.usermodel.*;
import org.apache.xmlbeans.XmlCursor;
import org.apache.xmlbeans.XmlException;
import org.docx4j.math.CTOMath;

import org.springframework.stereotype.Service;
import org.w3c.dom.Node;

import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import javax.xml.transform.stream.StreamSource;
import java.io.*;
import java.util.ArrayList;
import java.util.List;

@Service
public class DocxToHtmlConverter {

    public static String convertDocxToHtml(File docxFile) throws Exception {
        XWPFDocument document = new XWPFDocument(new FileInputStream(docxFile));
        List<XWPFParagraph> paragraphs = document.getParagraphs();
        //using a StringBuffer for appending all the content as HTML
        StringBuffer allHTML = new StringBuffer();

        //loop over all IBodyElements - should be self explained
        for (IBodyElement ibodyelement : document.getBodyElements()) {
            if (ibodyelement.getElementType().equals(BodyElementType.PARAGRAPH)) {
                XWPFParagraph paragraph = (XWPFParagraph)ibodyelement;
                allHTML.append("<p>");
                allHTML.append(getTextAndFormulas(paragraph));
                allHTML.append("</p>");
            } else if (ibodyelement.getElementType().equals(BodyElementType.TABLE)) {
                XWPFTable table = (XWPFTable)ibodyelement;
                allHTML.append("<table border=1>");
                for (XWPFTableRow row : table.getRows()) {
                    allHTML.append("<tr>");
                    for (XWPFTableCell cell : row.getTableCells()) {
                        allHTML.append("<td>");
                        for (XWPFParagraph paragraph : cell.getParagraphs()) {
                            allHTML.append("<p>");
                            allHTML.append(getTextAndFormulas(paragraph));
                            allHTML.append("</p>");
                        }
                        allHTML.append("</td>");
                    }
                    allHTML.append("</tr>");
                }
                allHTML.append("</table>");
            }
        }

        document.close();

        //creating a sample HTML file
        String encoding = "UTF-8";
        FileOutputStream fos = new FileOutputStream("result.html");
        OutputStreamWriter writer = new OutputStreamWriter(fos, encoding);
        writer.write("<!DOCTYPE html>\n");
        writer.write("<html lang=\"en\">");
        writer.write("<head>");
        writer.write("<meta charset=\"utf-8\"/>");

        //using MathJax for helping all browsers to interpret MathML
        writer.write("<script type=\"text/javascript\"");
        writer.write(" async src=\"https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.1/MathJax.js?config=MML_CHTML\"");
        writer.write(">");
        writer.write("</script>");

        writer.write("</head>");
        writer.write("<body>");

        writer.write(allHTML.toString());

        writer.write("</body>");
        writer.write("</html>");
        writer.close();

        StringBuilder htmlBuilder = new StringBuilder();
        htmlBuilder.append("<html><body>");


        htmlBuilder.append("</body></html>");
        return htmlBuilder.toString();
    }

    static String getTextAndFormulas(XWPFParagraph paragraph) throws Exception {

        StringBuffer textWithFormulas = new StringBuffer();

        //using a cursor to go through the paragraph from top to down
        XmlCursor xmlcursor = paragraph.getCTP().newCursor();

        while (xmlcursor.hasNextToken()) {
            XmlCursor.TokenType tokentype = xmlcursor.toNextToken();
            if (tokentype.isStart()) {
                if (xmlcursor.getName().getPrefix().equalsIgnoreCase("w") && xmlcursor.getName().getLocalPart().equalsIgnoreCase("r")) {
                    //elements w:r are text runs within the paragraph
                    //simply append the text data
                    textWithFormulas.append(xmlcursor.getTextValue());
                } else if (xmlcursor.getName().getLocalPart().equalsIgnoreCase("oMath")) {
                    //we have oMath
                    //append the oMath as MathML
                    //textWithFormulas.append(getMathML((CTOMath)xmlcursor.getObject()));
                }
            } else if (tokentype.isEnd()) {
                //we have to check whether we are at the end of the paragraph
                xmlcursor.push();
                xmlcursor.toParent();
                if (xmlcursor.getName().getLocalPart().equalsIgnoreCase("p")) {
                    break;
                }
                xmlcursor.pop();
            }
        }

        return textWithFormulas.toString();
    }


}