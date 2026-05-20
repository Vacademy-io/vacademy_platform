package vacademy.io.admin_core_service.features.product_page.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ProductPageEnrollResponse {

    private String paymentLogId;
    private String userId;
    private String status;
    private String message;

    /** Enrollment result per invite (in the same order as selectedMappings). */
    private List<String> enrolledPackageSessionIds;

    /** For async gateways (Cashfree, Razorpay order flow) — redirect the learner here. */
    private String paymentUrl;
    private String orderId;

    /** Razorpay: public key ID needed by the JS SDK to open the checkout. */
    private String razorpayKeyId;

    /** For auto-login after free or synchronous payment. */
    private String accessToken;
    private String refreshToken;
}
