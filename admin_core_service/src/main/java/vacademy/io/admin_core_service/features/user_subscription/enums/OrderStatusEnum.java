package vacademy.io.admin_core_service.features.user_subscription.enums;

public enum OrderStatusEnum {
    ORDERED,
    PREPARING_TO_SHIP,
    SHIPPED,
    IN_TRANSIT,
    DELIVERED;

    /**
     * Case-insensitive lookup; throws IllegalArgumentException if the value
     * does not match any constant.
     */
    public static OrderStatusEnum fromString(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Order status must not be empty");
        }
        try {
            return OrderStatusEnum.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Invalid order status: '" + value + "'. Allowed values: ORDERED, PREPARING_TO_SHIP, SHIPPED, IN_TRANSIT, DELIVERED");
        }
    }
}
