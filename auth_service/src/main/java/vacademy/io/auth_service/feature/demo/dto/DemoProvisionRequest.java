package vacademy.io.auth_service.feature.demo.dto;

import lombok.Data;

/**
 * What a super-admin fills in when turning a quote into a live demo workspace.
 * Deliberately minimal — branding, domains and theme belong to the real onboarding after payment.
 */
@Data
public class DemoProvisionRequest {

    /** The pricing quote this demo came from; stored on both sides for traceability. */
    private String quoteId;

    private String instituteName;
    private String instituteType;      // SCHOOL | DISTANCE_LEARNING | CORPORATE | UNIVERSITY

    private String adminFullName;
    private String adminEmail;
    private String adminUsername;
    private String adminPassword;
    private String adminPhone;

    /** When the demo stops being accessible. Required — a demo without an end date is a giveaway. */
    private String expiresAt;          // ISO-8601, e.g. 2026-08-02T18:30:00

    /** Institute whose courses should be copied in as starter content. Optional for now. */
    private String templateInstituteId;
}
