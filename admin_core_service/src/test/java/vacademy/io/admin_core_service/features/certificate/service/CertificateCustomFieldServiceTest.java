package vacademy.io.admin_core_service.features.certificate.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Admin-defined certificate fields.
 *
 * <p>The risk this feature carries is shadowing: admins choose the keys, and the
 * keys share a namespace with built-in tokens like {@code {{STUDENT_NAME}}}. A
 * field that shadowed one would silently replace every learner's name with a
 * constant, on every certificate, with nothing to notice it by.
 */
class CertificateCustomFieldServiceTest {

    private CustomFieldValuesRepository values;
    private CertificateCustomFieldService service;

    @BeforeEach
    void setUp() {
        values = mock(CustomFieldValuesRepository.class);
        when(values.findBySourceIdAndFieldKeyAndSourceType(anyString(), anyString(), anyString()))
                .thenReturn(Optional.empty());
        service = new CertificateCustomFieldService(new ObjectMapper(), values);
    }

    private String settingWith(String customFieldsJson) {
        return """
                {"setting":{"CERTIFICATE_SETTING":{"data":{"data":[
                  {"key":"COURSE_COMPLETION","customFields":%s}
                ]}}}}
                """.formatted(customFieldsJson);
    }

    // ------------------------------------------------------------------ static

    @Test
    void staticFieldsRenderTheLiteralValue() {
        Map<String, String> tokens = service.resolveTokens(
                settingWith("""
                        [{"key":"SIGNATORY_ROLE","valueType":"STATIC","value":"Director of Studies"}]"""),
                "user-1");

        assertEquals("Director of Studies", tokens.get("{{CF_SIGNATORY_ROLE}}"));
    }

    /** A missing valueType is the shape older saves have; STATIC is the safe read. */
    @Test
    void absentValueTypeIsTreatedAsStatic() {
        Map<String, String> tokens = service.resolveTokens(
                settingWith("""
                        [{"key":"MOTTO","value":"Per aspera ad astra"}]"""),
                "user-1");

        assertEquals("Per aspera ad astra", tokens.get("{{CF_MOTTO}}"));
    }

    // ------------------------------------------------------------ learner data

    @Test
    void customFieldTypeReadsTheLearnersOwnAnswer() {
        CustomFieldValues answer = new CustomFieldValues();
        answer.setValue("Distinction");
        when(values.findBySourceIdAndFieldKeyAndSourceType("user-1", "final_grade", "USER"))
                .thenReturn(Optional.of(answer));

        Map<String, String> tokens = service.resolveTokens(
                settingWith("""
                        [{"key":"GRADE","valueType":"CUSTOM_FIELD","value":"final_grade",
                          "fallbackValue":"Pass"}]"""),
                "user-1");

        assertEquals("Distinction", tokens.get("{{CF_GRADE}}"));
    }

    /**
     * A blank where a grade should be reads as a broken certificate, so an
     * unanswered field falls back rather than rendering nothing.
     */
    @Test
    void fallsBackWhenTheLearnerHasNoAnswer() {
        Map<String, String> tokens = service.resolveTokens(
                settingWith("""
                        [{"key":"GRADE","valueType":"CUSTOM_FIELD","value":"final_grade",
                          "fallbackValue":"Pass"}]"""),
                "user-1");

        assertEquals("Pass", tokens.get("{{CF_GRADE}}"));
    }

    // ------------------------------------------------------------- namespacing

    /**
     * The whole reason for the CF_ prefix: an admin must not be able to define a
     * field that overwrites a built-in token.
     */
    @Test
    void adminKeysCannotShadowBuiltInTokens() {
        Map<String, String> tokens = service.resolveTokens(
                settingWith("""
                        [{"key":"STUDENT_NAME","valueType":"STATIC","value":"Hijacked"}]"""),
                "user-1");

        assertFalse(tokens.containsKey("{{STUDENT_NAME}}"),
                "an admin-defined field shadowed the real student name token");
        assertEquals("Hijacked", tokens.get("{{CF_STUDENT_NAME}}"));
    }

    // -------------------------------------------------------- key normalisation

    /**
     * Keys are normalised on both sides — here and in the editor that emits the
     * token — so a key typed with spaces or lowercase still matches instead of
     * silently rendering blank.
     */
    @Test
    void keysAreNormalisedToTheTokenShape() {
        assertEquals("FINAL_GRADE", CertificateCustomFieldService.normaliseKey("  final grade "));
        assertEquals("GRADE_2026", CertificateCustomFieldService.normaliseKey("Grade-2026"));
        assertEquals("A_B", CertificateCustomFieldService.normaliseKey("__a...b__"));
        assertNull(CertificateCustomFieldService.normaliseKey("   "));
        assertNull(CertificateCustomFieldService.normaliseKey("!!!"));
        assertNull(CertificateCustomFieldService.normaliseKey(null));
    }

    // --------------------------------------------------------------- tolerance

    /**
     * A malformed or absent settings blob must not stop a learner receiving a
     * certificate — it just means there are no custom fields to substitute.
     */
    @Test
    void toleratesMissingAndMalformedSettings() {
        assertTrue(service.resolveTokens(null, "user-1").isEmpty());
        assertTrue(service.resolveTokens("not json at all", "user-1").isEmpty());
        assertTrue(service.resolveTokens("{}", "user-1").isEmpty());
        assertTrue(service.resolveTokens(settingWith("null"), "user-1").isEmpty());
    }

    /** Bulk issuance can hand over a null user; static fields must still render. */
    @Test
    void staticFieldsStillRenderWithoutAUser() {
        Map<String, String> tokens = service.resolveTokens(
                settingWith("""
                        [{"key":"MOTTO","valueType":"STATIC","value":"Ad astra"},
                         {"key":"GRADE","valueType":"CUSTOM_FIELD","value":"final_grade","fallbackValue":"—"}]"""),
                null);

        assertEquals("Ad astra", tokens.get("{{CF_MOTTO}}"));
        assertEquals("—", tokens.get("{{CF_GRADE}}"));
    }

    /** A definition with no key is skipped rather than producing a {{CF_}} token. */
    @Test
    void skipsDefinitionsWithNoUsableKey() {
        Map<String, String> tokens = service.resolveTokens(
                settingWith("""
                        [{"key":"","valueType":"STATIC","value":"x"},
                         {"valueType":"STATIC","value":"y"}]"""),
                "user-1");

        assertTrue(tokens.isEmpty(), "produced a token from a keyless definition: " + tokens);
    }
}
