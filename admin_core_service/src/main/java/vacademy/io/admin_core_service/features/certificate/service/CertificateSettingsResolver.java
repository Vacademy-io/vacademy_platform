package vacademy.io.admin_core_service.features.certificate.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.certificate.dto.CourseCertificateSettingDto;
import vacademy.io.admin_core_service.features.certificate.dto.ResolvedCertificateConfig;
import vacademy.io.admin_core_service.features.course_settings.service.PackageSettingService;
import vacademy.io.admin_core_service.features.institute.dto.settings.certificate.CertificateNumberingDto;
import vacademy.io.common.institute.entity.Institute;

import java.util.HashMap;
import java.util.Map;

/**
 * The single place certificate precedence is decided:
 * {@code course override → institute default → disabled}.
 *
 * <p>Certificates are <em>opt-in</em>. A missing or unset flag means off at both
 * levels, so a newly created institute issues nothing until someone deliberately
 * switches it on. This is the behaviour that was missing entirely: before, the
 * institute toggle was never read server-side and every learner past the
 * threshold received a certificate regardless of it.
 *
 * <p>The course layer is stored in {@code package.course_setting} under the
 * {@code CERTIFICATE_SETTING} key through the existing {@link PackageSettingService},
 * so no new per-course storage was needed.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CertificateSettingsResolver {

    private final PackageSettingService packageSettingService;
    private final ObjectMapper objectMapper;

    public static final String CERTIFICATE_SETTING_KEY = "CERTIFICATE_SETTING";
    public static final int DEFAULT_THRESHOLD_PERCENT = 80;

    private static final Map<String, String> DEFAULT_PLACEHOLDERS = Map.of(
            "6", "Official Signatory",
            "7", " ");

    /**
     * @param packageId may be null — the institute defaults are then returned
     *                  unmodified (used by settings screens that have no course
     *                  context)
     */
    public ResolvedCertificateConfig resolve(Institute institute, String packageId, String certificateType) {
        ResolvedCertificateConfig.ResolvedCertificateConfigBuilder builder = instituteDefaults(institute, certificateType);
        ResolvedCertificateConfig base = builder.build();

        CourseCertificateSettingDto override = readCourseOverride(packageId);
        if (override == null) {
            return base;
        }

        if (override.getEnabled() != null) {
            base.setEnabled(override.getEnabled());
            base.setEnabledOverriddenByCourse(true);
        }
        if (override.getThresholdPercent() != null) {
            base.setThresholdPercent(override.getThresholdPercent());
            base.setThresholdOverriddenByCourse(true);
        }
        if (StringUtils.hasText(override.getTemplateHtml())) {
            base.setTemplateHtml(override.getTemplateHtml());
        }
        return base;
    }

    /** The raw course-level record, for screens that need to show it verbatim. */
    public CourseCertificateSettingDto getCourseOverride(String packageId) {
        return readCourseOverride(packageId);
    }

    private ResolvedCertificateConfig.ResolvedCertificateConfigBuilder instituteDefaults(Institute institute,
                                                                                         String certificateType) {
        ResolvedCertificateConfig.ResolvedCertificateConfigBuilder builder = ResolvedCertificateConfig.builder()
                .enabled(false)
                .thresholdPercent(DEFAULT_THRESHOLD_PERCENT)
                .placeHolders(new HashMap<>(DEFAULT_PLACEHOLDERS));

        String settingJson = institute != null ? institute.getSetting() : null;
        if (!StringUtils.hasText(settingJson)) {
            return builder;
        }

        try {
            JsonNode root = objectMapper.readTree(settingJson);
            JsonNode entries = root.path("setting").path(CERTIFICATE_SETTING_KEY).path("data").path("data");

            JsonNode config = null;
            if (entries.isArray()) {
                for (JsonNode candidate : entries) {
                    if (certificateType.equals(candidate.path("key").asText(null))) {
                        config = candidate;
                        break;
                    }
                }
            }
            if (config == null) {
                return builder;
            }

            // Opt-in: only an explicit `true` enables issuance.
            //
            // STUDENT_DISPLAY_SETTINGS.certificates is deliberately NOT consulted.
            // It used to hold a second copy of this flag and the threshold, edited
            // on a different settings page, and it was the only one the learner
            // client honoured — so the two could disagree about whether a
            // certificate was due. Certificate Settings is now the sole source.
            JsonNode toggle = config.path("isDefaultCertificateSettingOn");
            builder.enabled(toggle.isBoolean() && toggle.asBoolean());

            JsonNode threshold = config.path("autoIssuePercentage");
            if (threshold.isInt()) {
                builder.thresholdPercent(threshold.asInt());
            }

            String template = config.path("currentHtmlCertificateTemplate").asText(null);
            if (StringUtils.hasText(template)) {
                builder.templateHtml(template);
            }

            builder.aspectRatio(config.path("aspectRatio").asText(null));
            if (config.path("customWidthMm").isInt()) builder.customWidthMm(config.path("customWidthMm").asInt());
            if (config.path("customHeightMm").isInt()) builder.customHeightMm(config.path("customHeightMm").asInt());

            JsonNode placeholders = config.path("placeHoldersMapping");
            if (placeholders.isObject()) {
                Map<String, String> map = new HashMap<>();
                placeholders.fields().forEachRemaining(e -> map.put(e.getKey(), e.getValue().asText("")));
                builder.placeHolders(map);
            }

            JsonNode numbering = config.path("certificateNumbering");
            if (numbering.isObject()) {
                builder.numbering(objectMapper.convertValue(numbering, CertificateNumberingDto.class));
            }
        } catch (Exception e) {
            // An unparseable settings blob must never mint certificates. The old
            // code fell through to the bundled default template here, which is
            // how issuance survived the institute switch being off.
            log.warn("Failed to read certificate settings for institute {}; treating certificates as disabled",
                    institute != null ? institute.getId() : null, e);
            return ResolvedCertificateConfig.builder()
                    .enabled(false)
                    .thresholdPercent(DEFAULT_THRESHOLD_PERCENT)
                    .placeHolders(new HashMap<>(DEFAULT_PLACEHOLDERS));
        }

        return builder;
    }

    private CourseCertificateSettingDto readCourseOverride(String packageId) {
        if (!StringUtils.hasText(packageId)) {
            return null;
        }
        try {
            Object data = packageSettingService.getSettingData(packageId, CERTIFICATE_SETTING_KEY);
            if (data == null) {
                return null;
            }
            JsonNode node = objectMapper.convertValue(data, JsonNode.class);
            // PackageSettingService stores whatever the caller passed as `data`.
            // Tolerate the extra `data` nesting the institute envelope uses, so a
            // payload saved either way resolves the same.
            if (node.has("data") && node.get("data").isObject()) {
                node = node.get("data");
            }
            if (!node.isObject()) {
                return null;
            }
            return objectMapper.convertValue(node, CourseCertificateSettingDto.class);
        } catch (Exception e) {
            log.warn("Failed to read course certificate override for package {}; inheriting institute defaults",
                    packageId, e);
            return null;
        }
    }
}
