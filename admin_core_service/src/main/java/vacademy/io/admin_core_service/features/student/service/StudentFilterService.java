package vacademy.io.admin_core_service.features.student.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.student.entity.Student;
import vacademy.io.admin_core_service.features.student.repository.InstituteStudentRepository;

import java.util.List;

@Service
public class StudentFilterService {

    @Autowired
    InstituteStudentRepository instituteStudentRepository;
    public Page<Student> getAllStudentWithSearch(String name, List<String> instituteIds, Pageable pageable) {
        return instituteStudentRepository.getAllStudentWithSearch(name, instituteIds, pageable);
    }

    public Page<Student> getAllStudentWithFilter(List<String> statuses, List<String> gender, List<String> instituteIds, List<String> groupIds, List<String> packageSessionIds, Pageable pageable) {
        return instituteStudentRepository.getAllStudentWithFilter(statuses, gender, instituteIds, groupIds, packageSessionIds, pageable);
    }
}
