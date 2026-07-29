package vacademy.io.community_service.feature.pricing.dto;

import lombok.Data;

/**
 * What the plan builder sends to price a configuration. Everything is optional except the
 * student count — an empty request prices an empty plan rather than erroring.
 */
@Data
public class QuoteRequestDto {

    /** Links the quote to the lead when the prospect came from the onboarding form. */
    private String submissionId;
    private String slug;

    private String contactName;
    private String contactEmail;
    private String contactPhone;
    private String organizationName;

    private String currency = "INR";          // INR | USD
    private String billingCycle = "ANNUAL";   // MONTHLY | HALF_YEARLY | ANNUAL

    /** Headcount drives the bracket; bracketCode overrides it when the user picks manually. */
    private Integer studentCount;
    private String bracketCode;

    // ---- modules (each independently purchasable) --------------------------------
    private boolean lms;
    private boolean crm;
    private boolean payments;
    private boolean whatsapp;
    private boolean android;
    private boolean ios;
    private boolean parentApp;
    private boolean website;
    private boolean subOrgs;
    private boolean vacademyMeet;

    // ---- module configuration ----------------------------------------------------
    private Integer crmSeats;             // total seats, first 10 included in the base
    private Integer subOrgCount;          // total sub-orgs wanted
    private Integer meetSessionsPerMonth; // billed per session-hour

    /** BASIC | PREMIUM | DEDICATED — dedicated replaces premium rather than stacking. */
    private String supportTier = "BASIC";

    /** Internal mode only: a custom development line item agreed with the prospect. */
    private String customFeatureLabel;
    private java.math.BigDecimal customFeatureAmount;

    /** Internal mode only: overrides the bracket's per-student rate. */
    private java.math.BigDecimal perStudentOverride;
}
