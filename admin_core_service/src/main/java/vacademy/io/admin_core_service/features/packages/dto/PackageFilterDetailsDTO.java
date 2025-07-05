package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.institute.dto.LevelDTO;
import vacademy.io.common.institute.dto.PackageSessionDTO;
import vacademy.io.common.institute.dto.SessionDTO;
import vacademy.io.common.institute.entity.LevelProjection;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class PackageFilterDetailsDTO {
    private List<String> tags;
    private List<LevelProjection> levels;
    private List<PackageSessionDTO>batchesForSession;
}
