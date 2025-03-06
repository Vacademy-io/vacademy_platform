package vacademy.io.common.core.utils;

import com.itextpdf.text.*;
import com.itextpdf.text.pdf.PdfPCell;
import com.itextpdf.text.pdf.PdfPTable;
import com.itextpdf.text.pdf.PdfWriter;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import vacademy.io.common.exceptions.VacademyException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.stream.Stream;

public class DataToCsvConverter {

    public static <T> ResponseEntity<byte[]> convertListToCsv(List<T> dataFromDatabase) {
        if (dataFromDatabase == null || dataFromDatabase.isEmpty()) {
            return ResponseEntity.noContent().build(); // Handle empty list case
        }

        StringBuilder csvBuilder = new StringBuilder();

        // Get the class type of T
        Class<?> clazz = dataFromDatabase.get(0).getClass();

        // Generate CSV header
        Field[] fields = clazz.getDeclaredFields();
        for (Field field : fields) {
            csvBuilder.append(field.getName()).append(","); // Add field names as headers
        }
        csvBuilder.setLength(csvBuilder.length() - 1); // Remove last comma
        csvBuilder.append("\n");

        // Generate CSV data rows
        for (T item : dataFromDatabase) {
            for (Field field : fields) {
                field.setAccessible(true); // Allow access to private fields
                try {
                    Object value = field.get(item);
                    csvBuilder.append(value != null ? value.toString() : "").append(","); // Handle null values
                } catch (IllegalAccessException e) {
                    e.printStackTrace(); // Handle exception as needed
                }
            }
            csvBuilder.setLength(csvBuilder.length() - 1); // Remove last comma
            csvBuilder.append("\n");
        }

        String csvData = csvBuilder.toString();

        // Set response headers for CSV download
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename("data.csv").build());
        headers.setContentType(MediaType.TEXT_PLAIN);

        // Return the CSV data as a response entity
        return ResponseEntity.ok().headers(headers).body(csvData.getBytes());
    }

    public static <T> ResponseEntity<InputStreamResource> buildPdfResponse(String title, String subTitle, List<T> dataFromDatabase, String lowercaseFilename){
        ByteArrayInputStream pdfStream = convertListToPdf(title, subTitle, dataFromDatabase);
        HttpHeaders headers = new HttpHeaders();
        headers.add("Content-Disposition", "inline; filename="+lowercaseFilename+".pdf");
        return ResponseEntity.ok()
                .headers(headers)
                .contentType(MediaType.APPLICATION_PDF)
                .body(new InputStreamResource(pdfStream));

    }

    public static <T> ByteArrayInputStream convertListToPdf(String title, String subTitle, List<T> dataFromDatabase) {
        Document document = new Document();
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter.getInstance(document, out);
            document.open();

            // Add title to the document
            if(!Objects.isNull(title) && !title.isEmpty()){
                Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 16);
                Paragraph paraTitle = new Paragraph(title, titleFont);
                paraTitle.setAlignment(Element.ALIGN_CENTER);
                document.add(paraTitle);
                document.add(Chunk.NEWLINE);
            }

            // Add subtitle
            if (subTitle != null && !subTitle.isEmpty()) {
                Font subTitleFont = FontFactory.getFont(FontFactory.HELVETICA, 12, BaseColor.DARK_GRAY);
                Paragraph paraSubTitle = new Paragraph(subTitle, subTitleFont);
                paraSubTitle.setAlignment(Element.ALIGN_CENTER);
                document.add(paraSubTitle);
                document.add(Chunk.NEWLINE);
            }

            Class<?> clazz = dataFromDatabase.get(0).getClass();
            List<String> HEADERS = new ArrayList<>();

            Field[] fields = clazz.getDeclaredFields();
            for (Field field : fields) {
                HEADERS.add(field.getName().toUpperCase()); // Add field names as headers
            }

            PdfPTable table = new PdfPTable(HEADERS.size());
            table.setWidthPercentage(100);

            int columnCount = HEADERS.size();
            int[] columnWidths = new int[columnCount];
            Arrays.fill(columnWidths, 2); // Assign equal widths dynamically
            table.setWidths(columnWidths);

            // Table header
            Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 12, BaseColor.WHITE);
            BaseColor headerBgColor = new BaseColor(54, 69, 79); // Dark gray-blue header

            for (String columnTitle : HEADERS) {
                PdfPCell header = new PdfPCell(new Phrase(columnTitle, headerFont));
                header.setBackgroundColor(headerBgColor);
                header.setHorizontalAlignment(Element.ALIGN_CENTER);
                header.setPadding(8f);
                table.addCell(header);
            }

            // Table data
            float MINIMUM_HEIGHT = 40f;
            float LEFT_PADDING = 10f;

            Font bodyFont = FontFactory.getFont(FontFactory.HELVETICA, 11);
            BaseColor altRowColor = new BaseColor(230, 230, 230);

            boolean alternateRow = false;
            for (T item : dataFromDatabase) {
                Field[] currentField = clazz.getDeclaredFields();
                alternateRow = !alternateRow; // Toggle row color

                for (Field field : currentField) {
                    field.setAccessible(true);
                    Object value = field.get(item);

                    PdfPCell cell = new PdfPCell(new Phrase(value != null ? value.toString() : "", bodyFont));
                    cell.setPadding(6f);
                    cell.setHorizontalAlignment(Element.ALIGN_CENTER);
                    if (alternateRow) {
                        cell.setBackgroundColor(altRowColor);
                    }
                    table.addCell(cell);
                }
            }

            document.add(table);
            document.close();
        } catch (Exception e) {
            throw new RuntimeException("Some Error Occurred: " + e.getMessage());
        }
        return new ByteArrayInputStream(out.toByteArray());
    }
}
