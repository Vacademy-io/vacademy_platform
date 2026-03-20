package vacademy.io.admin_core_service.features.packages.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.course.dto.AddFacultyToCourseDTO;
import vacademy.io.admin_core_service.features.enroll_invite.service.DefaultEnrollInviteService;
import vacademy.io.admin_core_service.features.faculty.service.FacultyService;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.learner_invitation.dto.AddLearnerInvitationDTO;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.admin_core_service.features.learner_invitation.util.LearnerInvitationDefaultFormGenerator;
import vacademy.io.admin_core_service.features.packages.dto.ParentChildBatchMappingResponseDTO;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class PackageSessionService {

    private final PackageSessionRepository packageRepository;
    private final FacultyService facultyService;
    private final LearnerInvitationService learnerInvitationService;
    private final DefaultEnrollInviteService defaultEnrollInviteService;
    private final StudentSessionInstituteGroupMappingRepository studentSessionRepository;

    public void createPackageSession(Level level, Session session, PackageEntity packageEntity, Group group,
            Date startTime, String instituteId, CustomUserDetails userDetails,
            List<AddFacultyToCourseDTO> addFacultyToCourseDTOS) {
        createPackageSession(level, session, packageEntity, group, startTime, instituteId, userDetails,
                addFacultyToCourseDTOS, null, null, null);
    }

    public void createPackageSession(Level level, Session session, PackageEntity packageEntity, Group group,
            Date startTime, String instituteId, CustomUserDetails userDetails,
            List<AddFacultyToCourseDTO> addFacultyToCourseDTOS, Integer maxSeats) {
        createPackageSession(level, session, packageEntity, group, startTime, instituteId, userDetails,
                addFacultyToCourseDTOS, maxSeats, null, null);
    }

    public void createPackageSession(Level level, Session session, PackageEntity packageEntity, Group group,
            Date startTime, String instituteId, CustomUserDetails userDetails,
            List<AddFacultyToCourseDTO> addFacultyToCourseDTOS, Integer maxSeats, Boolean isParent, String parentId) {
        PackageSession packageSession = new PackageSession();
        packageSession.setSession(session);
        packageSession.setLevel(level);
        packageSession.setPackageEntity(packageEntity);
        packageSession.setStatus(PackageStatusEnum.ACTIVE.name());
        packageSession.setStartTime(startTime);
        packageSession.setGroup(group);
        packageSession.setIsParent(isParent != null ? isParent : false);
        packageSession.setParentId(parentId);

        if (maxSeats != null) {
            packageSession.setMaxSeats(maxSeats);
            packageSession.setAvailableSlots(maxSeats);
        }

        packageSession = packageRepository.save(packageSession);
        createDefaultInvitationForm(packageSession, instituteId, userDetails);
        facultyService.addFacultyToBatch(addFacultyToCourseDTOS, packageSession.getId(), instituteId);
        defaultEnrollInviteService.createDefaultEnrollInvite(packageSession, instituteId);
        createLearnerInvitationForm(List.of(packageSession), instituteId, userDetails);
    }

    @Transactional
    public PackageSession updateInventory(String packageSessionId, Integer maxSeats, Integer availableSlots) {
        PackageSession packageSession = findById(packageSessionId);

        Integer currentMax = packageSession.getMaxSeats();
        Integer currentAvailable = packageSession.getAvailableSlots();

        // If admin is directly setting availableSlots (e.g., new books arrived, donated, damaged)
        if (availableSlots != null) {
            packageSession.setAvailableSlots(availableSlots);
            log.info("Admin directly set availableSlots to {} for packageSession {}", availableSlots, packageSessionId);
        }

        if (maxSeats == null && availableSlots == null) {
            // Switching to unlimited
            packageSession.setMaxSeats(null);
            packageSession.setAvailableSlots(null);
        } else if (maxSeats != null) {
            // Switching to limited or updating limit
            if (currentMax == null && availableSlots == null) {
                // Was unlimited, now limited.
                // We must check current usage to set accurate available slots.
                long currentEnrollments = studentSessionRepository.countByPackageSessionIdAndStatus(packageSessionId,
                        "ACTIVE");

                int newAvailable = maxSeats - (int) currentEnrollments;
                if (newAvailable < 0) {
                    // If we are already overbooked, we set available to 0.
                    // The admin is setting a limit lower than current students.
                    newAvailable = 0;
                }
                packageSession.setAvailableSlots(newAvailable);

            } else if (availableSlots == null) {
                // Adjust available slots by the difference (only if admin didn't directly set availableSlots)
                int diff = maxSeats - (currentMax != null ? currentMax : 0);
                if (currentAvailable == null) {
                    // Should not happen if maxSeats was not null, but for safety:
                    long currentEnrollments = studentSessionRepository
                            .countByPackageSessionIdAndStatus(packageSessionId, "ACTIVE");
                    int newAvailable = maxSeats - (int) currentEnrollments;
                    packageSession.setAvailableSlots(Math.max(newAvailable, 0));
                } else {
                    packageSession.setAvailableSlots(Math.max(currentAvailable + diff, 0));
                }
            }
            packageSession.setMaxSeats(maxSeats);
        }

        return packageRepository.save(packageSession);
    }

    @Transactional
    public void reserveSlot(String packageSessionId) {
        PackageSession packageSession = findById(packageSessionId);
        if (packageSession.getMaxSeats() == null) {
            return; // Unlimited
        }

        if (packageSession.getAvailableSlots() != null && packageSession.getAvailableSlots() > 0) {
            packageSession.setAvailableSlots(packageSession.getAvailableSlots() - 1);
            packageRepository.save(packageSession);
        } else {
            throw new VacademyException("No slots available");
        }
    }

    @Transactional
    public void releaseSlot(String packageSessionId) {
        PackageSession packageSession = findById(packageSessionId);
        if (packageSession.getMaxSeats() == null) {
            return; // Unlimited
        }

        if (packageSession.getAvailableSlots() != null) {
            if (packageSession.getAvailableSlots() < packageSession.getMaxSeats()) {
                packageSession.setAvailableSlots(packageSession.getAvailableSlots() + 1);
                packageRepository.save(packageSession);
            }
        }
    }

    /**
     * Decrements available slots when a user enrolls in a package session (borrows a book).
     * - If maxSeats is null (unlimited), we skip inventory update.
     * - If available slots are insufficient, we log a warning but do NOT block the enrollment.
     *
     * @param packageSessionId the package session being enrolled into
     * @param count            number of slots to decrement (usually 1)
     */
    @Transactional
    public void decrementAvailability(String packageSessionId, int count) {
        PackageSession packageSession = findById(packageSessionId);

        if (packageSession.getMaxSeats() == null) {
            log.debug("Skipping inventory decrement for packageSession {} — unlimited seats", packageSessionId);
            return;
        }

        Integer currentAvailable = packageSession.getAvailableSlots();
        if (currentAvailable == null || currentAvailable <= 0) {
            log.warn("Inventory decrement skipped for packageSession {} — availableSlots is {} but enrollment proceeding",
                    packageSessionId, currentAvailable);
            return;
        }

        int newAvailable = Math.max(currentAvailable - count, 0);
        packageSession.setAvailableSlots(newAvailable);
        packageRepository.save(packageSession);

        log.info("Decremented inventory for packageSession {}: availableSlots {} -> {}",
                packageSessionId, currentAvailable, newAvailable);
    }

    /**
     * Increments available slots when a user returns a book / is de-assigned.
     * - If maxSeats is null (unlimited), we skip.
     * - Caps at maxSeats to prevent exceeding total stock.
     *
     * @param packageSessionId the package session being returned
     * @param count            number of slots to increment (usually 1)
     */
    @Transactional
    public void incrementAvailability(String packageSessionId, int count) {
        PackageSession packageSession = findById(packageSessionId);

        if (packageSession.getMaxSeats() == null) {
            log.debug("Skipping inventory increment for packageSession {} — unlimited seats", packageSessionId);
            return;
        }

        Integer currentAvailable = packageSession.getAvailableSlots();
        if (currentAvailable == null) {
            currentAvailable = 0;
        }

        int newAvailable = Math.min(currentAvailable + count, packageSession.getMaxSeats());
        packageSession.setAvailableSlots(newAvailable);
        packageRepository.save(packageSession);

        log.info("Incremented inventory for packageSession {}: availableSlots {} -> {}",
                packageSessionId, currentAvailable, newAvailable);
    }

    public java.util.Map<String, Object> getAvailability(String packageSessionId) {
        PackageSession packageSession = findById(packageSessionId);
        java.util.Map<String, Object> map = new java.util.HashMap<>();
        map.put("packageSessionId", packageSessionId);
        map.put("maxSeats", packageSession.getMaxSeats());
        map.put("availableSlots", packageSession.getAvailableSlots());
        map.put("isUnlimited", packageSession.getMaxSeats() == null);
        return map;
    }

    @Async
    private void createDefaultInvitationForm(PackageSession packageSession, String instituteId,
            CustomUserDetails userDetails) {
        AddLearnerInvitationDTO learnerInvitationDTO = LearnerInvitationDefaultFormGenerator
                .generateSampleInvitation(packageSession, instituteId);
        learnerInvitationService.createLearnerInvitationCode(learnerInvitationDTO, userDetails);
    }

    public PackageSession updatePackageSession(String packageSessionId, String status, String instituteId,
            List<AddFacultyToCourseDTO> addFacultyToCourseDTOS) {
        System.out.println(packageSessionId);
        PackageSession packageSession = packageRepository.findById(packageSessionId).get();
        packageSession.setStatus(status);
        packageRepository.save(packageSession);
        facultyService.updateFacultyToSubjectPackageSession(addFacultyToCourseDTOS, packageSessionId, instituteId);
        return packageSession;
    }

    @Async
    public void createLearnerInvitationForm(List<PackageSession> packageSessions, String instituteId,
            CustomUserDetails userDetails) {
        List<AddLearnerInvitationDTO> addLearnerInvitationDTOS = new ArrayList<>();
        for (PackageSession packageSession : packageSessions) {
            AddLearnerInvitationDTO addLearnerInvitationDTO = LearnerInvitationDefaultFormGenerator
                    .generateSampleInvitation(packageSession, instituteId);
            addLearnerInvitationDTOS.add(addLearnerInvitationDTO);
        }
        learnerInvitationService.createLearnerInvitationCodes(addLearnerInvitationDTOS, userDetails);
    }

    public PackageSession findById(String id) {
        return packageRepository.findById(id).orElseThrow(() -> new VacademyException("Package Session not found"));
    }

    public List<PackageSession> findAllByIds(List<String> ids) {
        return packageRepository.findAllById(ids);
    }

    public void addInvitedPackageSessionForPackage(PackageEntity packageEntity) {
        Session session = new Session();
        Level level = new Level();
        session.setId("INVITED");
        level.setId("INVITED");
        PackageSession packageSession = new PackageSession();
        packageSession.setSession(session);
        packageSession.setLevel(level);
        packageSession.setPackageEntity(packageEntity);
        packageSession.setStatus(PackageSessionStatusEnum.INVITED.name());
        packageRepository.save(packageSession);
    }

    /**
     * Mark a package session as parent and assign one or more children by setting their parent_id.
     *
     * This is intentionally conservative:
     * - Validates that parent + children all belong to the given institute.
     * - Ensures parent is marked isParent = true and parentId = null.
     * - Sets parentId = parentPackageSessionId for each selected child.
     * - Does NOT automatically clear parentId from non-selected children.
     */
    @Transactional
    public ParentChildBatchMappingResponseDTO mapParentAndChildren(
            String instituteId,
            String parentPackageSessionId,
            List<String> childPackageSessionIds) {

        if (parentPackageSessionId == null || parentPackageSessionId.isBlank()) {
            throw new VacademyException("parentPackageSessionId is required");
        }

        // Normalize child IDs (allow null/empty list)
        List<String> safeChildIds = childPackageSessionIds != null ? childPackageSessionIds : List.of();

        // Build full set of IDs (parent + children), ensuring uniqueness
        Set<String> allIds = new HashSet<>();
        allIds.add(parentPackageSessionId);
        allIds.addAll(safeChildIds);

        // Fetch all sessions for this institute in a single query
        List<PackageSession> sessions = packageRepository
                .findPackageSessionsByInstituteIdAndIds(instituteId, new ArrayList<>(allIds));

        if (sessions.size() != allIds.size()) {
            throw new VacademyException("One or more package sessions not found for institute " + instituteId);
        }

        // Locate parent
        PackageSession parent = sessions.stream()
                .filter(ps -> ps.getId().equals(parentPackageSessionId))
                .findFirst()
                .orElseThrow(() -> new VacademyException("Parent package session not found"));

        // Mark parent
        parent.setIsParent(true);
        parent.setParentId(null);

        // Assign children
        for (PackageSession ps : sessions) {
            if (safeChildIds.contains(ps.getId())) {
                if (ps.getId().equals(parentPackageSessionId)) {
                    continue; // skip if someone accidentally selected parent as child
                }
                ps.setParentId(parentPackageSessionId);
            }
        }

        packageRepository.saveAll(sessions);

        return new ParentChildBatchMappingResponseDTO(
                parentPackageSessionId,
                safeChildIds.size(),
                safeChildIds
        );
    }
}
