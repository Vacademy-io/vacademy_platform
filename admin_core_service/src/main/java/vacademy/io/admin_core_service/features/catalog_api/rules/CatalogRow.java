package vacademy.io.admin_core_service.features.catalog_api.rules;

import vacademy.io.admin_core_service.features.packages.dto.ComingSoonDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailV2DTO;
import vacademy.io.common.auth.dto.UserDTO;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * One row of the open catalogue search (v2): one level (package session) of one course. The
 * fields the hosted site's discovery logic reads, copied out of {@link PackageDetailV2DTO} so
 * the rules never touch the internal DTO (and tests can build rows directly).
 *
 * <p>The image is the site's card image: preview image, else banner, else thumbnail
 * (CourseCatalogComponent's {@code thumbnailField}). Price is {@code min_plan_actual_price || 0}.
 */
public record CatalogRow(
        String packageId,
        String packageSessionId,
        String title,
        String levelName,
        String levelId,
        String sessionId,
        String tags,
        double price,
        Double elevatedPrice,
        String currency,
        String enrollInviteId,
        String enrollInviteAvailability,
        ComingSoon comingSoon,
        String descriptionHtml,
        String aboutHtml,
        String whyLearnHtml,
        String whoShouldLearnHtml,
        String imageMediaId,
        String courseMediaId,
        List<Person> instructors,
        Double rating,
        Instant createdAt) {

    /** A course switched to Coming Soon (only built when the setting is on). */
    public record ComingSoon(String launchDate, String audienceId) {
    }

    /** A course instructor / author as the public pages may show them (never an email). */
    public record Person(String id, String name, String imageFileId, String subtitle, String bioHtml) {
    }

    public static CatalogRow from(PackageDetailV2DTO d) {
        ComingSoonDTO cs = d.getComingSoon();
        ComingSoon comingSoon = cs != null && Boolean.TRUE.equals(cs.getEnabled())
                ? new ComingSoon(trimToNull(cs.getLaunchDate()), trimToNull(cs.getAudienceId()))
                : null;
        List<Person> people = new ArrayList<>();
        if (d.getInstructors() != null) {
            for (UserDTO u : d.getInstructors()) {
                if (u == null) continue;
                people.add(new Person(u.getId(), trimToNull(u.getFullName()), trimToNull(u.getProfilePicFileId()),
                        trimToNull(u.getAuthorSubtitle()), u.getAuthorDescription()));
            }
        }
        String image = firstText(d.getCoursePreviewImageMediaId(), d.getCourseBannerMediaId(), d.getThumbnailFileId());
        return new CatalogRow(
                d.getId(),
                d.getPackageSessionId(),
                d.getPackageName() == null ? "" : d.getPackageName(),
                d.getLevelName(),
                d.getLevelId(),
                d.getSessionId(),
                d.getCommaSeparetedTags(),
                d.getMinPlanActualPrice() == null ? 0 : d.getMinPlanActualPrice(),
                d.getMinPlanElevatedPrice(),
                d.getCurrency(),
                trimToNull(d.getEnrollInviteId()),
                d.getEnrollInviteAvailability(),
                comingSoon,
                d.getCourseHtmlDescriptionHtml(),
                d.getAboutTheCourseHtml(),
                d.getWhyLearnHtml(),
                d.getWhoShouldLearnHtml(),
                image,
                d.getCourseMediaId(),
                people,
                d.getRating(),
                d.getCreatedAt() == null ? null : d.getCreatedAt().toInstant());
    }

    private static String firstText(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank() && !"null".equals(v.trim()) && !"undefined".equals(v.trim())) {
                return v.trim();
            }
        }
        return null;
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
