package vacademy.io.admin_core_service.features.super_admin.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.super_admin.dto.InstituteCourseDTO;
import vacademy.io.admin_core_service.features.super_admin.dto.SuperAdminPageResponse;

import java.sql.Timestamp;
import java.util.Date;
import java.util.List;

@Slf4j
@Service
public class SuperAdminCourseService {

    @Autowired
    private InstituteRepository instituteRepository;

    @Transactional(readOnly = true)
    @Cacheable(value = "superAdminInstituteCourses",
            key = "#instituteId + ':' + #page + ':' + #size + ':' + (#search != null ? #search : '')")
    public SuperAdminPageResponse<InstituteCourseDTO> getInstituteCourses(
            String instituteId, String search, int page, int size) {
        try {
            int offset = page * size;
            List<Object[]> rows = instituteRepository.findCoursesByInstituteWithCounts(
                    instituteId, search, size, offset);
            Long total = instituteRepository.countCoursesByInstitute(instituteId, search);

            List<InstituteCourseDTO> content = rows.stream()
                    .map(this::mapToCourseDTO)
                    .toList();

            return SuperAdminPageResponse.<InstituteCourseDTO>builder()
                    .content(content)
                    .page(page)
                    .size(size)
                    .totalElements(total)
                    .totalPages((int) Math.ceil((double) total / size))
                    .build();
        } catch (Exception e) {
            log.error("Error listing courses for institute {}: {}", instituteId, e.getMessage(), e);
            return SuperAdminPageResponse.<InstituteCourseDTO>builder()
                    .content(List.of())
                    .page(page)
                    .size(size)
                    .totalElements(0)
                    .totalPages(0)
                    .build();
        }
    }

    private InstituteCourseDTO mapToCourseDTO(Object[] row) {
        return InstituteCourseDTO.builder()
                .id(row[0] != null ? row[0].toString() : null)
                .packageName(row[1] != null ? row[1].toString() : null)
                .status(row[2] != null ? row[2].toString() : null)
                .thumbnailFileId(row[3] != null ? row[3].toString() : null)
                .createdAt(row[4] instanceof Timestamp ts ? new Date(ts.getTime()) : null)
                .chapterCount(row[5] instanceof Number n ? n.longValue() : 0L)
                .studentCount(row[6] instanceof Number n ? n.longValue() : 0L)
                .batchCount(row[7] instanceof Number n ? n.longValue() : 0L)
                .build();
    }
}
