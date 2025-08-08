package vacademy.io.admin_core_service.features.user_resolution.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class PackageSessionsRequest {
    private List<String> packageSessionIds;
}