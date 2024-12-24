package vacademy.io.admin_core_service.features.student.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.student.dto.StudentStatusUpdateRequest;
import vacademy.io.admin_core_service.features.student.repository.StudentSessionRepository;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

@Service
public class StudentSessionManager {

    @Autowired
    private StudentSessionRepository studentSessionRepository;

    @Transactional
    public void updateStudentStatus(List<StudentStatusUpdateRequest> requests, String operation) {
        for (StudentStatusUpdateRequest request : requests) {
            try {
                switch (operation) {
                    case "UPDATE_BATCH":
                        studentSessionRepository.updatePackageSessionId(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), request.getNewState());
                        break;
                    case "ADD_EXPIRY":
                        SimpleDateFormat dateFormat = new SimpleDateFormat("dd-MM-yyyy");
                        Date expiryDate = dateFormat.parse(request.getNewState());
                        studentSessionRepository.updateExpiryDate(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), expiryDate);
                        break;
                    case "MAKE_INACTIVE":
                        studentSessionRepository.updateStatus(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), request.getNewState());
                        break;
                    case "MAKE_ACTIVE":
                        studentSessionRepository.updateStatus(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), "ACTIVE");
                        break;
                    case "UPDATE_STATUS":
                        studentSessionRepository.updateStatus(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), request.getNewState());
                        break;
                    case "TERMINATE":
                        studentSessionRepository.updateStatus(request.getUserId(), request.getCurrentPackageSessionId(), request.getInstituteId(), "TERMINATED");
                        break;
                    default:
                        throw new IllegalArgumentException("Invalid operation: " + operation);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

    }
}
