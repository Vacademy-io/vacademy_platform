package vacademy.io.admin_core_service.features.slide.enums;

import org.springframework.util.StringUtils;

import java.util.regex.Pattern;

public enum VideoSlideSourceType {
    YOUTUBE,
    DRIVE,
    VIMEO;

    /** Matches vimeo.com/<id>, vimeo.com/video/<id> and player.vimeo.com/video/<id>. */
    private static final Pattern VIMEO_URL_PATTERN =
            Pattern.compile("(?:vimeo\\.com/(?:video/)?|player\\.vimeo\\.com/video/)\\d+");

    /** A bare media-service file id — never a link, so it can only be an upload. */
    private static final Pattern FILE_ID_PATTERN =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    /** Stored as a plain string rather than an enum constant, as elsewhere. */
    private static final String FILE_ID = "FILE_ID";

    /**
     * Fills in a missing {@code source_type} from the video URL.
     *
     * <p>The column is nullable and clients are trusted to send the value, so an
     * import that omits it leaves Vimeo-backed slides with no source type. The
     * players key off this field and treat an unknown value as YouTube, which
     * cannot play a Vimeo link — the learner just gets an empty frame. Inferring
     * it here keeps that from being reintroduced.
     *
     * <p>Only VIMEO and FILE_ID are inferred, because the stored value
     * identifies them unambiguously: a Vimeo link, or a bare file id with no
     * scheme. A YouTube/Drive link is already handled by the players' default
     * branch, so guessing there would change existing rows without fixing
     * anything. Returns {@code sourceType} untouched (possibly null) when it is
     * already set or the value says nothing.
     */
    public static String resolveSourceType(String sourceType, String url, String publishedUrl) {
        if (StringUtils.hasText(sourceType)) {
            return sourceType;
        }
        String candidate = StringUtils.hasText(publishedUrl) ? publishedUrl : url;
        if (!StringUtils.hasText(candidate)) {
            return sourceType;
        }
        candidate = candidate.trim();
        if (VIMEO_URL_PATTERN.matcher(candidate).find()) {
            return VIMEO.name();
        }
        if (FILE_ID_PATTERN.matcher(candidate).matches()) {
            return FILE_ID;
        }
        return sourceType;
    }
}
