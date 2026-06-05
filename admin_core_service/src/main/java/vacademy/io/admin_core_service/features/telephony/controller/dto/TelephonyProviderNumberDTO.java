package vacademy.io.admin_core_service.features.telephony.controller.dto;

import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;

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
                .build();
    }
}
