package vacademy.io.community_service.feature.onboarding.enums;

/**
 * The four kinds of institute we cater to. Each maps 1:1 to a seeded demo account
 * ({@code onboarding_demo_account.institute_type}).
 */
public enum InstituteType {
    SCHOOL("School"),
    DISTANCE_LEARNING("Distance Learning"),
    CORPORATE("Corporate"),
    UNIVERSITY("University");

    private final String label;

    InstituteType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
