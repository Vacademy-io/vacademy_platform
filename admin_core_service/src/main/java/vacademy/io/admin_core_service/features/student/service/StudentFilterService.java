package vacademy.io.admin_core_service.features.student.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.student.entity.Student;
import vacademy.io.admin_core_service.features.student.repository.InstituteStudentRepository;

import java.util.ArrayList;
import java.util.List;

@Service
public class StudentFilterService {

    @Autowired
    InstituteStudentRepository instituteStudentRepository;

    public Page<Student> getAllStudentWithSearch(String name, List<String> instituteIds, Pageable pageable) {

        // Ensure instituteIds is not null
        List<String> safeInstituteIds = (instituteIds != null) ? instituteIds : new ArrayList<>();

        return instituteStudentRepository.getAllStudentWithSearch(name, safeInstituteIds, pageable);
    }

    public Page<Student> getAllStudentWithFilter(List<String> statuses, List<String> gender, List<String> instituteIds, List<String> groupIds, List<String> packageSessionIds, Pageable pageable) {

        // Ensure all lists are not null
        List<String> safeStatuses = (statuses != null) ? statuses : new ArrayList<>();
        List<String> safeGender = (gender != null) ? gender : new ArrayList<>();
        List<String> safeInstituteIds = (instituteIds != null) ? instituteIds : new ArrayList<>();
        List<String> safeGroupIds = (groupIds != null) ? groupIds : new ArrayList<>();
        List<String> safePackageSessionIds = (packageSessionIds != null) ? packageSessionIds : new ArrayList<>();

        return instituteStudentRepository.getAllStudentWithFilter(safeStatuses, safeGender, safeInstituteIds, safeGroupIds, safePackageSessionIds, pageable);
    }
}
