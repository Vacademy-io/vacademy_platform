package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.level.dto.LevelDTOWithPackageSession;
import vacademy.io.common.institute.dto.PackageDTO;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@AllArgsConstructor
@NoArgsConstructor
public class PackageDTOWithDetails {
    private PackageDTO packageDTO;
    private List<LevelDTOWithPackageSession> level;
}
