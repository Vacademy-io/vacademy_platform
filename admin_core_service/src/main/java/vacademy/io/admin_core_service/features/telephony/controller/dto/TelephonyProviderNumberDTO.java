package vacademy.io.admin_core_service.features.telephony.controller.dto;

import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;

import java.sql.Timestamp;

@Data
@Builder
@NoArgsConstructor
@lombok.AllArgsConstructor
public class TelephonyProviderNumberDTO {
    private String id;
    private String instituteId;
    private String providerType;
    private String phoneNumber;
    private String providerResourceId;
    private String label;
    private String region;
    private Integer priority;
    private Boolean enabled;
    /** Inbound-flow attach status: ATTACHED | PENDING | FAILED | DETACHED | null. */
    private String flowAttachStatus;
    /** Body / message of the most recent attach failure. Null when ATTACHED. */
    private String flowAttachError;
    /** Wall-clock of the most recent successful attach. Null when never attached. */
    private Timestamp flowAttachedAt;

    public static TelephonyProviderNumberDTO from(TelephonyProviderNumber n) {
        return TelephonyProviderNumberDTO.builder()
                .id(n.getId())
                .instituteId(n.getInstituteId())
                .providerType(n.getProviderType())
                .phoneNumber(n.getPhoneNumber())
                .providerResourceId(n.getProviderResourceId())
                .label(n.getLabel())
                .region(n.getRegion())
                .priority(n.getPriority())
                .enabled(n.getEnabled())
                .flowAttachStatus(n.getFlowAttachStatus())
                .flowAttachError(n.getFlowAttachError())
                .flowAttachedAt(n.getFlowAttachedAt())
                .build();
    }
}
