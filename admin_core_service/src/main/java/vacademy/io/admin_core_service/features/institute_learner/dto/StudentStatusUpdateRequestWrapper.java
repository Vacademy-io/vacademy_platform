package vacademy.io.admin_core_service.features.institute_learner.dto;

import lombok.Data;

import java.util.List;

@Data
public class StudentStatusUpdateRequestWrapper {
    private List<StudentStatusUpdateRequest> requests;
    private String operation;
}