package vacademy.io.admin_core_service.features.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteDetailSummaryDTO {
    private String id;
    private String name;
    private String email;
    private String mobileNumber;
    private String city;
    private String state;
    private String country;
    private String address;
    private String pinCode;
    private String type;
    private String websiteUrl;
    private String logoFileId;
    private String subdomain;
    private Date createdAt;
    private Date updatedAt;

    private Long studentCount;
    private Long courseCount;
    private Long batchCount;
    private Long subjectCount;
    private Long levelCount;
    private Integer profileCompletionPercentage;

    private Map<String, Object> creditBalance;
    private String leadTag;
}
