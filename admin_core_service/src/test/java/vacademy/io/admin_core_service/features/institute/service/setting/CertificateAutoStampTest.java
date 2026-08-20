package vacademy.io.admin_core_service.features.institute.service.setting;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Whether the platform stamps the code and the number onto an issued certificate.
 *
 * <p>The stamp used to be unconditional: any design that did not position them
 * itself got them bottom-right. So an admin who deleted the QR from their
 * design watched it come back on every certificate, with nothing anywhere to
 * turn it off — which is the report these tests close.
 *
 * <p>The default is the other half. Absent, malformed and unreadable all have to
 * mean <em>on</em>: a certificate carrying its number and a scannable code when
 * it did not have to is a cosmetic surprise, while one silently missing them
 * cannot be verified at all.
 */
class CertificateAutoStampTest {

    private String setting(String fields) {
        return """
                {"setting":{"CERTIFICATE_SETTING":{"data":{"data":[{
                   "key":"COURSE_COMPLETION"%s
                }]}}}}""".formatted(fields.isEmpty() ? "" : "," + fields);
    }

    @Test
    void stampsBothWhenTheInstituteHasNotSaidOtherwise() {
        String json = setting("");
        assertTrue(InstituteSettingService.isAutoStampEnabled(json, "autoStampCode"));
        assertTrue(InstituteSettingService.isAutoStampEnabled(json, "autoStampNumber"));
    }

    @Test
    void stopsStampingTheCodeWhenItIsSwitchedOff() {
        String json = setting("\"autoStampCode\":false");
        assertFalse(InstituteSettingService.isAutoStampEnabled(json, "autoStampCode"));
        // Two separate decisions: switching the code off must not take the
        // number with it.
        assertTrue(InstituteSettingService.isAutoStampEnabled(json, "autoStampNumber"));
    }

    @Test
    void stopsStampingTheNumberWhenItIsSwitchedOff() {
        String json = setting("\"autoStampNumber\":false");
        assertFalse(InstituteSettingService.isAutoStampEnabled(json, "autoStampNumber"));
        assertTrue(InstituteSettingService.isAutoStampEnabled(json, "autoStampCode"));
    }

    @Test
    void anExplicitTrueStampsAsBefore() {
        String json = setting("\"autoStampCode\":true,\"autoStampNumber\":true");
        assertTrue(InstituteSettingService.isAutoStampEnabled(json, "autoStampCode"));
        assertTrue(InstituteSettingService.isAutoStampEnabled(json, "autoStampNumber"));
    }

    /** Nothing about a settings blob is guaranteed; none of it may drop the stamp silently. */
    @Test
    void degenerateSettingsStampAsBefore() {
        assertTrue(InstituteSettingService.isAutoStampEnabled(null, "autoStampCode"));
        assertTrue(InstituteSettingService.isAutoStampEnabled("", "autoStampCode"));
        assertTrue(InstituteSettingService.isAutoStampEnabled("{not json", "autoStampCode"));
        assertTrue(InstituteSettingService.isAutoStampEnabled("{}", "autoStampCode"));
        // Present but the wrong type — a client sending a string, say.
        assertTrue(InstituteSettingService.isAutoStampEnabled(
                setting("\"autoStampCode\":\"false\""), "autoStampCode"));
    }

    /** Only the COURSE_COMPLETION record's switch applies to a course certificate. */
    @Test
    void readsTheSwitchOffTheRightCertificateType() {
        String json = """
                {"setting":{"CERTIFICATE_SETTING":{"data":{"data":[
                   {"key":"SOMETHING_ELSE","autoStampCode":false},
                   {"key":"COURSE_COMPLETION","autoStampCode":true}
                ]}}}}""";
        assertTrue(InstituteSettingService.isAutoStampEnabled(json, "autoStampCode"));
    }
}
