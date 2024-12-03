package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import vacademy.io.common.institute.entity.Package;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackageDTO {
    private String id;
    private String packageName;

    // Constructor from Package entity
    public PackageDTO(Package packageEntity) {
        this.id = packageEntity.getId();
        this.packageName = packageEntity.getPackageName();
    }
}