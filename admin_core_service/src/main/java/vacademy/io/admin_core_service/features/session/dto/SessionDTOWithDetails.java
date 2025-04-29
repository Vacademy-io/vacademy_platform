package vacademy.io.admin_core_service.features.session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.packages.dto.PackageDTOWithDetails;
import vacademy.io.common.institute.dto.SessionDTO;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@AllArgsConstructor
@NoArgsConstructor
@Data
public class SessionDTOWithDetails {
    private SessionDTO session;
    private List<PackageDTOWithDetails> packages;
}
