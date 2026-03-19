package vacademy.io.admin_core_service.features.fee_management.dto;

import lombok.Data;

import java.util.List;

@Data
public class CollectionDashboardRequestDTO {
    private String instituteId;
    private String sessionId;         // nullable – if null, all sessions in the institute
    private List<String> feeTypes;    // nullable / empty – if empty, all fee types
}
