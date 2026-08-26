package vacademy.io.assessment_service.features.assessment.dto;

/**
 * Flat projection of one answer a participant gave to one registration-form
 * custom field. Used by the result CSV export to widen each participant row
 * with the details collected at registration time (external participants of a
 * public assessment fill these in on the public registration page).
 */
public interface RegistrationCustomFieldAnswerDto {
    String getRegistrationId();

    String getFieldId();

    String getAnswer();
}
