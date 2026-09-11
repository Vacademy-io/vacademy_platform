package vacademy.io.admin_core_service.features.enroll_invite.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Date;
import java.sql.Timestamp;
import java.util.List;

/**
 * One row of the paginated invite list ({@code POST /enroll-invite/get-enroll-invite}).
 *
 * <p>Mirrors {@link EnrollInviteWithSessionsProjection} field for field — same
 * snake_case JSON the two admin surfaces already parse — and adds the actor
 * names. Names cannot live on the interface projection: they come from one
 * batched auth_service lookup per page, not from the row, so the service maps
 * the projection here and fills them in afterwards.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EnrollInviteListItemDTO {
    private String id;
    private String name;
    private Date endDate;
    private Date startDate;
    private String inviteCode;
    private String status;
    private String instituteId;
    private String vendor;
    private String vendorId;
    private String currency;
    private String tag;
    private String webPageMetaDataJson;
    private Timestamp createdAt;
    private Timestamp updatedAt;
    private String shortUrl;
    private List<String> packageSessionIds;

    private String createdByUserId;
    /** Display name for {@link #createdByUserId}; null when unknown or auth_service was unreachable. */
    private String createdByName;
    private String updatedByUserId;
    /** Display name for {@link #updatedByUserId}; null when unknown or auth_service was unreachable. */
    private String updatedByName;

    public static EnrollInviteListItemDTO from(EnrollInviteWithSessionsProjection row, String absoluteShortUrl) {
        return EnrollInviteListItemDTO.builder()
                .id(row.getId())
                .name(row.getName())
                .endDate(row.getEndDate())
                .startDate(row.getStartDate())
                .inviteCode(row.getInviteCode())
                .status(row.getStatus())
                .instituteId(row.getInstituteId())
                .vendor(row.getVendor())
                .vendorId(row.getVendorId())
                .currency(row.getCurrency())
                .tag(row.getTag())
                .webPageMetaDataJson(row.getWebPageMetaDataJson())
                .createdAt(row.getCreatedAt())
                .updatedAt(row.getUpdatedAt())
                .shortUrl(absoluteShortUrl)
                .packageSessionIds(row.getPackageSessionIds())
                .createdByUserId(row.getCreatedByUserId())
                .updatedByUserId(row.getUpdatedByUserId())
                .build();
    }
}
