package vacademy.io.admin_core_service.features.student.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.student.dto.StudentDTO;
import vacademy.io.admin_core_service.features.student.dto.student_list_dto.AllStudentResponse;
import vacademy.io.admin_core_service.features.student.dto.student_list_dto.StudentListFilter;
import vacademy.io.admin_core_service.features.student.entity.Student;
import vacademy.io.admin_core_service.features.student.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.student.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.student.service.StudentFilterService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.internal_api_wrapper.InternalClientUtils;
import vacademy.io.common.core.standard_classes.ListService;

import java.util.*;

@Component
public class StudentListManager {

    @Autowired
    InternalClientUtils internalClientUtils;

    @Autowired
    InstituteStudentRepository instituteStudentRepository;

    @Autowired
    StudentSessionRepository studentSessionRepository;

    @Autowired
    StudentFilterService studentFilterService;

    @Value("${auth.server.baseurl}")
    private String authServerBaseUrl;
    @Value("${spring.application.name}")
    private String applicationName;

    public ResponseEntity<AllStudentResponse> getLinkedStudents(CustomUserDetails user, StudentListFilter studentListFilter, int pageNo, int pageSize) {
        // Create a sorting object based on the provided sort columns
        Sort thisSort = ListService.createSortObject(studentListFilter.getSortColumns());

        // Create a pageable instance for pagination
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        // Retrieve employees based on the filter criteria
        Page<Student> studentPage = null;

        // Check if the filter contains a numeric name
        if (StringUtils.hasText(studentListFilter.getName())) {
            studentPage = studentFilterService.getAllStudentWithSearch(studentListFilter.getName(), studentListFilter.getInstituteIds(), pageable);
        }

        if (Objects.isNull(studentPage) && !studentListFilter.getInstituteIds().isEmpty()) {
            studentPage = studentFilterService.getAllStudentWithFilter(studentListFilter.getStatuses(), studentListFilter.getGender(), studentListFilter.getInstituteIds(), studentListFilter.getGroupIds(), studentListFilter.getPackageSessionIds(), pageable);
        }

        return ResponseEntity.ok(createAllStudentResponseFromPaginatedData(studentPage));

    }

    private AllStudentResponse createAllStudentResponseFromPaginatedData(Page<Student> studentPage) {
        List<StudentDTO> content = new ArrayList<>();
        if (!Objects.isNull(studentPage)) {
            content = studentPage.getContent().stream().map(StudentDTO::new).toList();
            return AllStudentResponse.builder().content(content).pageNo(studentPage.getNumber()).last(studentPage.isLast()).pageSize(studentPage.getSize()).totalPages(studentPage.getTotalPages()).totalElements(studentPage.getTotalElements()).build();
        }
        return AllStudentResponse.builder().totalPages(0).content(content).pageNo(0).totalPages(0).build();
    }

}
