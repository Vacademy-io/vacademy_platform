package vacademy.io.admin_core_service.features.user_subscription.enums;

/**
 * Enum for coupon code source types
 */
public enum CouponSourceType {
    USER("USER"),
    STUDENT_REGISTRATION("STUDENT_REGISTRATION"),
    LEARNER_ENROLLMENT("LEARNER_ENROLLMENT"),
    ADMIN("ADMIN"),
    SYSTEM("SYSTEM");

    private final String value;

    CouponSourceType(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    @Override
    public String toString() {
        return value;
    }
}


