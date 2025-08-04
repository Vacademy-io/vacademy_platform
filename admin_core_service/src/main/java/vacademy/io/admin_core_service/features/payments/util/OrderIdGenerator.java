package vacademy.io.admin_core_service.features.payments.util;

import java.util.UUID;

public class OrderIdGenerator {
    public static String generateOrderId() {
        return "order_" + UUID.randomUUID().toString();
    }
}
