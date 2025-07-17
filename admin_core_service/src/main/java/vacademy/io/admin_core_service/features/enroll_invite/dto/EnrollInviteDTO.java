package vacademy.io.admin_core_service.features.enroll_invite.dto;

import lombok.Data;

import java.sql.Date;
import java.util.List;

@Data
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
    private String webPageMetaDataJson;
    private List<PackageSessionToPaymentOptionDTO> packageSessionToPaymentOptions;
}
