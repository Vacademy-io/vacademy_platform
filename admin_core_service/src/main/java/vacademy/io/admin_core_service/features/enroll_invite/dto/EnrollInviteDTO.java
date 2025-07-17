package vacademy.io.admin_core_service.features.enroll_invite.dto;

import vacademy.io.admin_core_service.features.user_subscription.dto.PaymentOptionDTO;

import java.util.Date;

public class EnrollInviteDTO {
    private String id;
    private String name;
    private Date startDate;
    private Date endDate;
    private String inviteCode;
    private String status;
    private String instituteId;
    private String vendor;
    private String vendorId;
    private String currency;
    private String tag;
    private String webPageMetaDataJson;
    private PaymentOptionDTO paymentOption;
}
