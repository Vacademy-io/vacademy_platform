package vacademy.io.admin_core_service.features.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteListItemDTO {
    private String id;
    private String name;
    private String email;
    private String city;
    private String state;
    private String type;
    private String logoFileId;
    private String subdomain;
    private Date createdAt;
    private Long studentCount;
    private Long courseCount;
    private Long batchCount;
    private String leadTag;
}
