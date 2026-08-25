package vacademy.io.admin_core_service.features.institute_learner.dto.batch_enrollment;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * The minimum a caller needs to say "this learner is enrolled in this batch".
 *
 * <p>Deliberately tiny. The only consumer is assessment_service's "not attempted yet"
 * list, which renders a name and a batch and nothing else, and it fetches the whole
 * enrolled set (see
 * {@code StudentSessionInstituteGroupMappingRepository#findEnrolledLearnersByPackageSessions}),
 * so every extra column is paid for once per learner over the wire. Adding fields here
 * is not free — check the caller actually renders them first.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public interface BatchEnrolledLearnerDto {
    String getUserId();

    String getFullName();

    String getPackageSessionId();
}
