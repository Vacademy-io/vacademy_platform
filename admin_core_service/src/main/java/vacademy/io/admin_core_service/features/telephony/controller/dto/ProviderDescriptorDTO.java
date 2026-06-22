package vacademy.io.admin_core_service.features.telephony.controller.dto;

import lombok.Builder;
import lombok.Data;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderCapability;
import vacademy.io.admin_core_service.features.telephony.spi.TelephonyProviderDescriptor;
import vacademy.io.admin_core_service.features.telephony.spi.dto.CredentialField;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Public projection of a {@link TelephonyProviderDescriptor} for
 * GET /v1/telephony/providers. Drives the admin "Calling service" dropdown, the
 * dynamically-rendered credential form, and capability-gated UI sections — so a
 * new provider needs no frontend changes, only a registered descriptor.
 */
@Data
@Builder
public class ProviderDescriptorDTO {
    private String providerType;
    private String displayName;
    private String authType;
    /** True => the admin form submits generic secrets/config maps; false (Exotel)
     *  => it submits the legacy apiAccountId/apiUsername/apiPassword fields. */
    private boolean usesGenericCredentialStore;
    private Set<String> capabilities;
    private List<CredentialField> credentialSchema;

    public static ProviderDescriptorDTO from(TelephonyProviderDescriptor d) {
        return ProviderDescriptorDTO.builder()
                .providerType(d.providerType())
                .displayName(d.displayName())
                .authType(d.authType())
                .usesGenericCredentialStore(d.usesGenericCredentialStore())
                .capabilities(d.capabilities().stream()
                        .map(ProviderCapability::name)
                        .collect(Collectors.toCollection(java.util.LinkedHashSet::new)))
                .credentialSchema(d.credentialSchema())
                .build();
    }
}
