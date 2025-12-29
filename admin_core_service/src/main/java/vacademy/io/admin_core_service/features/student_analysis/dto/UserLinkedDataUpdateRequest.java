package vacademy.io.admin_core_service.features.student_analysis.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserLinkedDataUpdateRequest {
        private String id; // for update and delete
        private String action; // "add", "update", "delete"
        private String type; // "strength" or "weakness"
        private String data; // e.g., "algebra"
        private Integer percentage; // for add and update
}