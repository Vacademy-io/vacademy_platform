package vacademy.io.common.payment.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class EwayTransactionQueryResponse {

    @JsonProperty("Transactions")
    private List<EwayTransaction> transactions; // Changed to use the new DTO

    @JsonProperty("Errors")
    private String errors;
}
