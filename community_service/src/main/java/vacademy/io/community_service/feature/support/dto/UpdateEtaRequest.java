package vacademy.io.community_service.feature.support.dto;

import lombok.Data;

import java.util.Date;

/** Super-admin: set or clear (null) the expected-resolution ETA on a ticket. */
@Data
public class UpdateEtaRequest {
    private Date eta;
}
