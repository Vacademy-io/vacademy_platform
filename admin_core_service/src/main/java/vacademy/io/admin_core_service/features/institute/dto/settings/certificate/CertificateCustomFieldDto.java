package vacademy.io.admin_core_service.features.institute.dto.settings.certificate;

import lombok.Getter;
import lombok.Setter;

/**
 * One admin-defined certificate field.
 *
 * <p>The built-in token list is fixed and platform-wide, so an institute that
 * wants "Grade", "Director of Studies" or an accreditation line on its
 * certificates previously had no way to get one. Dropping an unrecognised field
 * onto the canvas serialised to a {@code {{GRADE}}} token that nothing
 * substituted, and the raw token printed on the learner's PDF.
 *
 * <p>Definitions live in the institute's certificate setting rather than in a
 * table: they are template configuration, they are edited in the same dialog as
 * the rest of the template, and they must round-trip with it.
 */
@Setter
@Getter
public class CertificateCustomFieldDto {

    /**
     * Uppercase, underscore-separated identifier. Rendered into the template as
     * {@code {{CF_<KEY>}}} — namespaced so an admin cannot define a field that
     * shadows a built-in token like {@code {{STUDENT_NAME}}}.
     */
    private String key;

    /** What the chip is labelled in the editor. Never rendered onto the PDF. */
    private String displayName;

    /**
     * Where the value comes from:
     * <ul>
     *   <li>{@code STATIC} — the literal text in {@link #value}, the same on
     *       every certificate ("Director of Studies").</li>
     *   <li>{@code CUSTOM_FIELD} — the learner's own answer, looked up in
     *       {@code custom_field_values} by the field key in {@link #value}.
     *       Falls back to {@link #fallbackValue} when the learner has no answer,
     *       because a blank where a grade should be looks like a broken
     *       certificate.</li>
     * </ul>
     * Null is treated as {@code STATIC}.
     */
    private String valueType;

    /** Literal text for STATIC; the custom field's key for CUSTOM_FIELD. */
    private String value;

    /** Used when a CUSTOM_FIELD lookup finds nothing. Blank is allowed. */
    private String fallbackValue;
}
