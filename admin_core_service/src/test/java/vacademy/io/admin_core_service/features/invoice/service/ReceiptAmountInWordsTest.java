package vacademy.io.admin_core_service.features.invoice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * A fee receipt spells the amount out in words, so the figure and the words have to agree.
 * The scale is Indian: crore / lakh / thousand, not million.
 */
class ReceiptAmountInWordsTest {

    private static String words(String amount) {
        return InvoiceService.amountInWords(new BigDecimal(amount));
    }

    @Test
    @DisplayName("the amount on the sample I2CAN receipt reads as the client prints it")
    void sampleReceipt() {
        assertEquals("FIVE THOUSAND only", words("5000"));
    }

    @Test
    @DisplayName("Indian scale, not the short scale")
    void indianScale() {
        assertEquals("ONE LAKH TWENTY FIVE THOUSAND only", words("125000"));
        assertEquals("SEVENTY FIVE THOUSAND only", words("75000"));
        assertEquals("TEN LAKH only", words("1000000"));
        assertEquals("ONE CRORE only", words("10000000"));
        assertEquals("TWO CRORE FIFTY LAKH only", words("25000000"));
    }

    @Test
    @DisplayName("hundreds and the teens")
    void hundredsAndTeens() {
        assertEquals("ONE HUNDRED only", words("100"));
        assertEquals("NINE HUNDRED NINETY NINE only", words("999"));
        assertEquals("SIXTEEN only", words("16"));
        assertEquals("NINETEEN THOUSAND only", words("19000"));
    }

    @Test
    @DisplayName("paise appear only when there are any")
    void paise() {
        assertEquals("FIVE THOUSAND only", words("5000.00"));
        assertEquals("FIVE THOUSAND AND FIFTY PAISE only", words("5000.50"));
        assertEquals("NINETY NINE AND NINETY NINE PAISE only", words("99.99"));
    }

    @Test
    @DisplayName("nothing sensible to say for nothing, or for a negative")
    void edges() {
        assertEquals("ZERO only", words("0"));
        assertEquals("", InvoiceService.amountInWords(null));
        assertEquals("", InvoiceService.amountInWords(new BigDecimal("-1")));
    }

    @Test
    @DisplayName("the course code is the prefix of a plan name, and nothing when there is no code")
    void courseCode() {
        assertEquals("PGDAM",
                InvoiceService.deriveCourseCode("PGDAM - Post Graduate Diploma in Aesthetic Medicine (Offline)"));
        assertEquals("B&WSSC", InvoiceService.deriveCourseCode("B&WSSC - Beauty and Wellness"));
        // a plain course name carries no code, and a guess on a receipt is worse than a blank
        assertEquals("", InvoiceService.deriveCourseCode("Post Graduate Diploma in Aesthetic Medicine Pune Offline"));
        assertEquals("", InvoiceService.deriveCourseCode("Nutrition - In Skin"));
        assertEquals("", InvoiceService.deriveCourseCode(null));
        assertEquals("", InvoiceService.deriveCourseCode(""));
    }
}
