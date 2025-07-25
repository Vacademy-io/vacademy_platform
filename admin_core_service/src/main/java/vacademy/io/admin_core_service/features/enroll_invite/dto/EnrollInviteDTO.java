package vacademy.io.admin_core_service.features.enroll_invite.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;

import java.sql.Date;
import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EnrollInviteDTO {
    private String id;
    private String name;
    private java.sql.Date startDate;
    private Date endDate;
    private String inviteCode;
    private String status;
    private String instituteId;
    private String vendor;
    private String vendorId;
    private String currency;
    private String tag;
    private Integer learnerAccessDays;
    private String webPageMetaDataJson;
    private List<InstituteCustomFieldDTO> instituteCustomFields;
    private List<PackageSessionToPaymentOptionDTO> packageSessionToPaymentOptions;
}
