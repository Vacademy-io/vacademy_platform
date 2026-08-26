package vacademy.io.admin_core_service.features.certificate.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.certificate.dto.CourseCertificateSettingDto;
import vacademy.io.admin_core_service.features.certificate.dto.ResolvedCertificateConfig;
import vacademy.io.admin_core_service.features.course_settings.service.PackageSettingService;
import vacademy.io.common.institute.entity.Institute;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * A course following one of the institute's saved certificate designs.
 *
 * <p>The distinction these tests exist to protect: a course stores the design's
 * <em>id</em>, not a copy of it. A copy taken when the design was chosen goes
 * stale the moment the institute fixes a typo on the template — and the course
 * keeps printing the typo, with nothing on screen to explain why.
 */
class CourseCertificateTemplateResolutionTest {

    private static final String TYPE = "COURSE_COMPLETION";
    private static final String PACKAGE_ID = "pkg-1";

    private PackageSettingService packageSettings;
    private CertificateSettingsResolver resolver;

    @BeforeEach
    void setUp() {
        packageSettings = mock(PackageSettingService.class);
        when(packageSettings.getSettingData(anyString(), anyString())).thenReturn(null);
        resolver = new CertificateSettingsResolver(packageSettings, new ObjectMapper());
    }

    /** An institute with certificates on, one default design and one other. */
    private Institute institute() {
        String editorJson = """
                {"library":[
                   {"id":"tpl-a","name":"Completion","renderedHtml":"<html>DEFAULT {{STUDENT_NAME}}</html>"},
                   {"id":"tpl-b","name":"Participation","renderedHtml":"<html>OTHER {{COURSE_NAME}}</html>"},
                   {"id":"tpl-c","name":"Legacy"}
                 ],"defaultTemplateId":"tpl-a"}
                """.replace("\n", "");

        Institute institute = new Institute();
        institute.setId("inst-1");
        institute.setSetting("""
                {"setting":{"CERTIFICATE_SETTING":{"data":{"data":[{
                   "key":"COURSE_COMPLETION",
                   "isDefaultCertificateSettingOn":true,
                   "autoIssuePercentage":80,
                   "currentHtmlCertificateTemplate":"<html>DEFAULT {{STUDENT_NAME}}</html>",
                   "imageTemplateJson":%s
                }]}}}}""".formatted(new ObjectMapper().valueToTree(editorJson).toString()));
        return institute;
    }

    private void courseOverride(CourseCertificateSettingDto override) {
        when(packageSettings.getSettingData(PACKAGE_ID, CertificateSettingsResolver.CERTIFICATE_SETTING_KEY))
                .thenReturn(new ObjectMapper().convertValue(override, Map.class));
    }

    private ResolvedCertificateConfig resolve() {
        return resolver.resolve(institute(), PACKAGE_ID, TYPE);
    }

    @Test
    void aCourseThatChoosesNothingGetsTheInstituteDefault() {
        ResolvedCertificateConfig config = resolve();

        assertTrue(config.getTemplateHtml().contains("DEFAULT"));
        assertFalse(config.isTemplateOverriddenByCourse());
        assertNull(config.getTemplateId());
    }

    @Test
    void aCourseFollowingASavedDesignGetsThatDesign() {
        courseOverride(CourseCertificateSettingDto.builder().templateId("tpl-b").build());

        ResolvedCertificateConfig config = resolve();

        assertTrue(config.getTemplateHtml().contains("OTHER"), config.getTemplateHtml());
        assertTrue(config.isTemplateOverriddenByCourse());
        assertEquals("tpl-b", config.getTemplateId());
    }

    /**
     * The reason ids are stored rather than copies: the design is read at
     * issuance, so an edit in Settings reaches every course pointing at it.
     */
    @Test
    void editingTheSavedDesignReachesTheCourseFollowingIt() {
        courseOverride(CourseCertificateSettingDto.builder().templateId("tpl-b").build());
        Institute edited = institute();
        edited.setSetting(edited.getSetting().replace("OTHER", "EDITED"));

        ResolvedCertificateConfig config = resolver.resolve(edited, PACKAGE_ID, TYPE);

        assertTrue(config.getTemplateHtml().contains("EDITED"), config.getTemplateHtml());
    }

    /** A course that uploaded HTML of its own keeps using it. */
    @Test
    void aCourseWithItsOwnHtmlKeepsIt() {
        courseOverride(CourseCertificateSettingDto.builder()
                .templateHtml("<html>COURSE OWN</html>").build());

        ResolvedCertificateConfig config = resolve();

        assertTrue(config.getTemplateHtml().contains("COURSE OWN"));
        assertTrue(config.isTemplateOverriddenByCourse());
    }

    /** Both set can only happen on data written by an older client. */
    @Test
    void aChosenDesignWinsOverStaleUploadedHtml() {
        courseOverride(CourseCertificateSettingDto.builder()
                .templateId("tpl-b")
                .templateHtml("<html>COURSE OWN</html>")
                .build());

        assertTrue(resolve().getTemplateHtml().contains("OTHER"));
    }

    /**
     * Falling back to the institute default prints a certificate the institute
     * stands behind. The alternatives — printing nothing, or a half-resolved
     * template — are both worse for the learner who earned it.
     */
    @Test
    void aDeletedDesignFallsBackToTheInstituteDefault() {
        courseOverride(CourseCertificateSettingDto.builder().templateId("tpl-gone").build());

        ResolvedCertificateConfig config = resolve();

        assertTrue(config.getTemplateHtml().contains("DEFAULT"));
        assertFalse(config.isTemplateOverriddenByCourse(),
                "a design that no longer exists is not this course's design");
        assertNull(config.getTemplateId());
    }

    /** Entries saved before rendered HTML was stored per design have nothing to render. */
    @Test
    void aDesignWithNoRenderedHtmlFallsBackToTheInstituteDefault() {
        courseOverride(CourseCertificateSettingDto.builder().templateId("tpl-c").build());

        assertTrue(resolve().getTemplateHtml().contains("DEFAULT"));
    }

    /** Choosing a design must not disturb the on/off and threshold layers. */
    @Test
    void choosingADesignLeavesTheOtherOverridesAlone() {
        courseOverride(CourseCertificateSettingDto.builder()
                .templateId("tpl-b")
                .enabled(false)
                .thresholdPercent(55)
                .build());

        ResolvedCertificateConfig config = resolve();

        assertFalse(config.isEnabled());
        assertEquals(55, config.getThresholdPercent());
        assertTrue(config.isEnabledOverriddenByCourse());
        assertTrue(config.isThresholdOverriddenByCourse());
    }

    /** An institute that has never used the visual editor still issues its default. */
    @Test
    void anInstituteWithNoLibraryStillIssues() {
        courseOverride(CourseCertificateSettingDto.builder().templateId("tpl-b").build());
        Institute bare = new Institute();
        bare.setId("inst-2");
        bare.setSetting("""
                {"setting":{"CERTIFICATE_SETTING":{"data":{"data":[{
                   "key":"COURSE_COMPLETION",
                   "isDefaultCertificateSettingOn":true,
                   "currentHtmlCertificateTemplate":"<html>DEFAULT {{STUDENT_NAME}}</html>"
                }]}}}}""");

        assertTrue(resolver.resolve(bare, PACKAGE_ID, TYPE).getTemplateHtml().contains("DEFAULT"));
    }
}
