package vacademy.io.admin_core_service.features.faculty.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@AllArgsConstructor
@NoArgsConstructor
public class FacultyRequestFilter {
    private String name;
    private List<String> batches;
    private List<String> subjects;
    private List<String> status;
    private Map<String, String> sortColumns = new HashMap<>();
}
