package vacademy.io.admin_core_service.features.telephony.controller.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCounsellorEndpoint;

/** Wire shape for the per-counsellor endpoint admin API. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelephonyCounsellorEndpointDTO {
    private String id;
    private String counsellorUserId;
    private String providerType;
    private String extension;
    private String providerUserId;
    private String did;
    private Boolean enabled;

    public static TelephonyCounsellorEndpointDTO from(TelephonyCounsellorEndpoint e) {
        return TelephonyCounsellorEndpointDTO.builder()
                .id(e.getId())
                .counsellorUserId(e.getCounsellorUserId())
                .providerType(e.getProviderType())
                .extension(e.getExtension())
                .providerUserId(e.getProviderUserId())
                .did(e.getDid())
                .enabled(e.getEnabled())
                .build();
    }
}
