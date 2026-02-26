package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.dto.learner.LearnerExtraDetails;
import vacademy.io.common.common.dto.CustomFieldValueDTO;

import java.util.Date;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SchoolEnrollRequestDTO {

    /**
     * Student/parent user details
     */
    private UserDTO user;

    /**
     * Institute ID
     */
    private String instituteId;

    /**
     * The class/section package session ID
     */
    private String packageSessionId;

    /**
     * ComplexPaymentOption ID — defines the fee structure
     */
    private String cpoId;

    /**
     * PaymentOption ID — for UserPlan creation
     */
    private String paymentOptionId;

    /**
     * EnrollInvite ID — for validation
     */
    private String enrollInviteId;

    /**
     * Payment details (offline/online).
     * null = enroll without any payment now.
     */
    private SchoolPaymentDTO schoolPayment;

    /**
     * Optional student extra details (father name, mother name, etc.)
     */
    private LearnerExtraDetails learnerExtraDetails;

    /**
     * Optional custom field values
     */
    private List<CustomFieldValueDTO> customFieldValues;

    /**
     * Optional enrollment start date (defaults to today)
     */
    private Date startDate;
}
