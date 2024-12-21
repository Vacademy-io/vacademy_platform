package vacademy.io.admin_core_service.features.student.dto;

import lombok.Data;

import java.util.List;

@Data
public class StudentStatusUpdateRequestWrapper {
    private List<StudentStatusUpdateRequest> requests;
    private String operation;
}