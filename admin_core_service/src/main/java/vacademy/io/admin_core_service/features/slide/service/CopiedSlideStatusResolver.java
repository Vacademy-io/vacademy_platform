package vacademy.io.admin_core_service.features.slide.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;

import java.util.Map;

/**
 * Resolves the status a COPIED slide should get, honoring the institute's
 * {@code COURSE_SETTING.copiedSlideStatus} preference.
 *
 * <p>Values (stored on the institute's COURSE_SETTING JSON blob):
 * <ul>
 *   <li>{@code KEEP_DRAFT} — copy is always DRAFT (this is also the default when
 *       the setting is unset, so existing institutes see no behaviour change);</li>
 *   <li>{@code INHERIT_SOURCE} — copy keeps the source slide's status (a copy of a
 *       PUBLISHED slide is PUBLISHED, and therefore visible to learners);</li>
 *   <li>{@code ALWAYS_PUBLISHED} — copy is always PUBLISHED.</li>
 * </ul>
 *
 * <p>Learners only ever see PUBLISHED/UNSYNC slides, so with the default a copied
 * slide stays DRAFT (admin must publish it) — unchanged from before. An institute
 * opts into auto-publishing copies purely via Settings; no code change per flow.
 *
 * <p>Best-effort: any lookup failure falls back to DRAFT (the safe, current
 * behaviour) so a copy can never break on a settings read.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CopiedSlideStatusResolver {

    private static final String COURSE_SETTING = "COURSE_SETTING";
    private static final String FIELD = "copiedSlideStatus";
    private static final String INHERIT_SOURCE = "INHERIT_SOURCE";
    private static final String ALWAYS_PUBLISHED = "ALWAYS_PUBLISHED";

    private final PackageSessionRepository packageSessionRepository;
    private final InstituteSettingService instituteSettingService;

    /**
     * @param packageSessionId the batch the copy lands in (used to resolve the
     *                         owning institute; may be null)
     * @param sourceStatus     the source slide's status (used only for INHERIT_SOURCE)
     * @return the status to assign to the copied slide + its chapter link
     */
    public String resolveForCopy(String packageSessionId, String sourceStatus) {
        String pref = readPreference(packageSessionId);
        if (INHERIT_SOURCE.equalsIgnoreCase(pref)) {
            return (sourceStatus == null || sourceStatus.isBlank())
                    ? SlideStatus.DRAFT.name()
                    : sourceStatus;
        }
        if (ALWAYS_PUBLISHED.equalsIgnoreCase(pref)) {
            return SlideStatus.PUBLISHED.name();
        }
        // KEEP_DRAFT, unset, or unreadable -> current behaviour.
        return SlideStatus.DRAFT.name();
    }

    private String readPreference(String packageSessionId) {
        try {
            if (packageSessionId == null || packageSessionId.isBlank()) {
                return null;
            }
            String instituteId = packageSessionRepository
                    .findInstituteIdByPackageSessionId(packageSessionId)
                    .orElse(null);
            if (instituteId == null) {
                return null;
            }
            Object data = instituteSettingService.getSettingByInstituteIdAndKey(instituteId, COURSE_SETTING);
            if (data instanceof Map<?, ?> map) {
                Object value = map.get(FIELD);
                return value == null ? null : value.toString();
            }
            return null;
        } catch (Exception e) {
            log.warn("[CopiedSlideStatus] Could not read {}.{} for packageSession {}: {}",
                    COURSE_SETTING, FIELD, packageSessionId, e.getMessage());
            return null;
        }
    }
}
