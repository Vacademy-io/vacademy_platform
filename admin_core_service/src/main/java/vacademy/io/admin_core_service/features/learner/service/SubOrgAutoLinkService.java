package vacademy.io.admin_core_service.features.learner.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute_learner.entity.Student;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSubOrg;
import vacademy.io.admin_core_service.features.institute_learner.enums.StudentSubOrgLinkType;
import vacademy.io.admin_core_service.features.institute_learner.repository.InstituteStudentRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionRepository;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSubOrgRepository;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;
import java.util.Optional;

/**
 * Automatically links learners to a sub-org when a sub-org admin enrolls them.
 * <p>
 * This service is a safe no-op when:
 * - adminUserId is null or empty
 * - The admin has no faculty mapping with a suborgId for the given packageSession
 * - The SSIGM or StudentSubOrg entry already exists
 * <p>
 * This ensures existing non-sub-org enrollment flows are never affected.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgAutoLinkService {

    private final FacultySubjectPackageSessionMappingRepository facultyRepository;
    private final StudentSessionRepository studentSessionRepository;
    private final StudentSubOrgRepository studentSubOrgRepository;
    private final InstituteStudentRepository instituteStudentRepository;
    private final InstituteRepository instituteRepository;

    /**
     * After a learner SSIGM is created, check if the calling admin belongs to a sub-org
     * for that packageSession. If so, stamp the SSIGM with the sub-org and create
     * a StudentSubOrg junction entry.
     *
     * Uses REQUIRES_NEW propagation so this runs in its own transaction —
     * failures here never roll back the parent enrollment transaction.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void linkIfSubOrgAdmin(String learnerUserId, String packageSessionId,
                                   String mappingId, String adminUserId) {
        try {
            if (!StringUtils.hasText(adminUserId)) {
                log.debug("SubOrgAutoLink skipped: no adminUserId for learner={}, ps={}", learnerUserId, packageSessionId);
                return;
            }

            // Find if this admin has a sub-org faculty mapping for this packageSession
            List<String> subOrgIds = facultyRepository
                    .findSubOrgIdsByUserAndPackageSession(adminUserId, packageSessionId);

            if (CollectionUtils.isEmpty(subOrgIds)) {
                return; // Admin is not a sub-org admin for this packageSession — no-op
            }

            if (subOrgIds.size() > 1) {
                log.warn("Admin {} has {} sub-org mappings for packageSession {}. Using first: {}",
                        adminUserId, subOrgIds.size(), packageSessionId, subOrgIds.get(0));
            }

            String subOrgId = subOrgIds.get(0);
            log.info("Auto-linking learner={} to sub-org={} (admin={}, packageSession={})",
                    learnerUserId, subOrgId, adminUserId, packageSessionId);

            // 1. Stamp the SSIGM with sub-org and LEARNER role
            stampMappingWithSubOrg(mappingId, subOrgId);

            // 2. Create StudentSubOrg junction entry (handles duplicates gracefully)
            createStudentSubOrgEntry(learnerUserId, subOrgId);

        } catch (Exception e) {
            // Never break the enrollment flow — log and continue
            log.warn("SubOrgAutoLink failed for learner={}, packageSession={}: {}",
                    learnerUserId, packageSessionId, e.getMessage(), e);
        }
    }

    private void stampMappingWithSubOrg(String mappingId, String subOrgId) {
        if (!StringUtils.hasText(mappingId)) {
            log.warn("No mappingId provided for sub-org auto-link");
            return;
        }

        StudentSessionInstituteGroupMapping mapping =
                studentSessionRepository.findById(mappingId).orElse(null);

        if (mapping == null) {
            log.warn("Could not find SSIGM id={} for sub-org auto-link", mappingId);
            return;
        }

        // Only stamp if not already linked to a sub-org
        if (mapping.getSubOrg() != null) {
            log.debug("SSIGM already linked to sub-org={}, skipping", mapping.getSubOrg().getId());
            return;
        }

        Optional<Institute> subOrgOpt = instituteRepository.findById(subOrgId);
        if (subOrgOpt.isEmpty()) {
            log.warn("Sub-org institute not found: {}", subOrgId);
            return;
        }

        mapping.setSubOrg(subOrgOpt.get());
        if (mapping.getCommaSeparatedOrgRoles() == null) {
            mapping.setCommaSeparatedOrgRoles("LEARNER");
        }
        studentSessionRepository.save(mapping);
        log.info("Stamped SSIGM id={} with sub-org={}, role=LEARNER", mapping.getId(), subOrgId);
    }

    private void createStudentSubOrgEntry(String learnerUserId, String subOrgId) {
        Optional<StudentSubOrg> existing = studentSubOrgRepository
                .findByUserIdAndSubOrgId(learnerUserId, subOrgId);
        if (existing.isPresent()) {
            log.debug("StudentSubOrg already exists for user={}, sub-org={}", learnerUserId, subOrgId);
            return;
        }

        Optional<Student> studentOpt = instituteStudentRepository
                .findTopByUserIdOrderByCreatedAtDesc(learnerUserId);
        String studentId = studentOpt.map(Student::getId).orElse(learnerUserId);

        Optional<Institute> subOrgOpt = instituteRepository.findById(subOrgId);
        if (subOrgOpt.isEmpty()) return;

        try {
            StudentSubOrg entry = new StudentSubOrg(
                    studentId, learnerUserId, subOrgOpt.get(), StudentSubOrgLinkType.DIRECT.name());
            studentSubOrgRepository.save(entry);
            log.info("Created StudentSubOrg: user={}, sub-org={}", learnerUserId, subOrgId);
        } catch (DataIntegrityViolationException e) {
            // UNIQUE constraint (user_id, sub_org_id) — entry was created by a concurrent request
            log.debug("StudentSubOrg already exists (concurrent insert) for user={}, sub-org={}",
                    learnerUserId, subOrgId);
        }
    }
}
