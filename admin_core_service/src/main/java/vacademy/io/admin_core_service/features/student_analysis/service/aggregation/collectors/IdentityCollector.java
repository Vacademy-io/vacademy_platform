package vacademy.io.admin_core_service.features.student_analysis.service.aggregation.collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.InstituteSection;
import vacademy.io.admin_core_service.features.student_analysis.dto.comprehensive.StudentIdentitySection;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.List;
import java.util.Optional;

/**
 * Collects student identity and enrollment information from local repositories,
 * and institute metadata (name, logo, theme) from the institutes table.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class IdentityCollector {

    private final InstituteStudentRepository studentRepository;
    private final StudentSessionInstituteGroupMappingRepository mappingRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final InstituteRepository instituteRepository;

    /**
     * @param userId          the learner
     * @param packageSessionId optional batch scope (may be null)
     */
    public StudentIdentitySection collect(String userId, String packageSessionId) {
        try {
            List<Student> students = studentRepository.findByUserId(userId);
            if (students == null || students.isEmpty()) {
                log.warn("[IdentityCollector] No student record found for userId={}", userId);
                return StudentIdentitySection.builder().available(false).userId(userId).build();
            }

            // Take the most recent student record
            Student student = students.get(0);

            String enrollmentNo = null;
            String batch = null;
            String enrolledDate = null;
            String status = null;

            if (packageSessionId != null) {
                Optional<StudentSessionInstituteGroupMapping> mappingOpt =
                        mappingRepository.findByUserIdAndPackageSessionId(userId, packageSessionId);
                if (mappingOpt.isPresent()) {
                    StudentSessionInstituteGroupMapping mapping = mappingOpt.get();
                    enrollmentNo = mapping.getInstituteEnrolledNumber();
                    enrolledDate = mapping.getEnrolledDate() != null ? mapping.getEnrolledDate().toString() : null;
                    status = mapping.getStatus();
                    // Human-readable batch name = "Level Package (Session)".
                    // PackageSession.level/session/packageEntity are @ManyToOne EAGER, so findById
                    // initializes them — safe to read in this worker thread. Never fall back to the
                    // raw UUID (show nothing instead).
                    batch = packageSessionRepository.findById(packageSessionId)
                            .map(IdentityCollector::resolveBatchName)
                            .filter(s -> s != null && !s.isBlank())
                            .orElse(null);
                }
            }

            return StudentIdentitySection.builder()
                    .available(true)
                    .userId(userId)
                    .name(student.getFullName())
                    .enrollmentNo(enrollmentNo)
                    // roll_no: use enrollmentNo as fallback (no separate roll_no field in Student)
                    .rollNo(enrollmentNo)
                    .batch(batch)
                    // class: same as batch name (no separate "class" concept in the schema)
                    .classs(batch)
                    .avatarUrl(null)  // no avatar stored in Student entity
                    .enrolledDate(enrolledDate)
                    .status(status)
                    .parentsEmail(student.getParentsEmail())
                    .guardianEmail(student.getGuardianEmail())
                    .build();

        } catch (Exception e) {
            log.error("[IdentityCollector] Failed to collect identity for userId={}: {}", userId, e.getMessage());
            return StudentIdentitySection.builder().available(false).userId(userId).build();
        }
    }

    /** Builds "Level Package (Session)" from a package session; falls back to its own name. */
    private static String resolveBatchName(PackageSession ps) {
        String level = ps.getLevel() != null ? ps.getLevel().getLevelName() : null;
        String pkg = ps.getPackageEntity() != null ? ps.getPackageEntity().getPackageName() : null;
        String session = ps.getSession() != null ? ps.getSession().getSessionName() : null;
        StringBuilder sb = new StringBuilder();
        if (level != null && !level.isBlank()) sb.append(level.trim());
        if (pkg != null && !pkg.isBlank()) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(pkg.trim());
        }
        if (session != null && !session.isBlank()) {
            if (sb.length() > 0) sb.append(" ");
            sb.append("(").append(session.trim()).append(")");
        }
        if (sb.length() > 0) return sb.toString();
        return (ps.getName() != null && !ps.getName().isBlank()) ? ps.getName() : null;
    }

    /**
     * Collects institute metadata: name, logo URL, theme color.
     * Safe to call separately; returns a minimal section on failure.
     */
    public InstituteSection collectInstitute(String instituteId) {
        InstituteSection.InstituteSectionBuilder builder = InstituteSection.builder().id(instituteId);
        try {
            Optional<Institute> opt = instituteRepository.findById(instituteId);
            if (opt.isPresent()) {
                Institute inst = opt.get();
                builder.name(inst.getInstituteName());
                // logoFileId → construct a public CDN URL using the standard media path
                if (inst.getLogoFileId() != null && !inst.getLogoFileId().isBlank()) {
                    builder.logoUrl("https://media.vacademy.io/files/" + inst.getLogoFileId());
                }
                // instituteThemeCode used as brand color (may be a hex value)
                builder.themeColor(inst.getInstituteThemeCode());
            }
        } catch (Exception e) {
            log.warn("[IdentityCollector] Could not fetch institute metadata for id={}: {}", instituteId, e.getMessage());
        }
        return builder.build();
    }
}
