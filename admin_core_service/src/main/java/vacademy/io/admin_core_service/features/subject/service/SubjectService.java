package vacademy.io.admin_core_service.features.subject.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.dto.UpdateSubjectOrderDTO;
import vacademy.io.admin_core_service.features.module.entity.SubjectModuleMapping;
import vacademy.io.admin_core_service.features.subject.entity.SubjectPackageSession;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectPackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SubjectService {
    private final SubjectRepository subjectRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final SubjectPackageSessionRepository subjectPackageSessionRepository;
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;

    /**
     * Adds a new subject to the system.
     *
     * @param subjectDTO                 The DTO containing subject information.
     * @param commaSeparatedPackageSessionIds A comma-separated list of package session IDs.
     * @param user                       The user who is creating the subject.
     * @return The created subject DTO.
     * @throws VacademyException If there are any validation errors or if a required field is missing.
     */
    public SubjectDTO addSubject(SubjectDTO subjectDTO, String commaSeparatedPackageSessionIds, CustomUserDetails user) {
        if (Objects.isNull(commaSeparatedPackageSessionIds)) {
            throw new VacademyException("Package Session Id cannot be null");
        }

        validateSubject(subjectDTO); // Validate the subject DTO before proceeding.

        Subject subject = new Subject();
        createSubject(subjectDTO, subject); // Create a Subject entity from the DTO.

        Subject savedSubject = subjectRepository.save(subject); // Save the subject to the database.
        subjectDTO.setId(savedSubject.getId()); // Set the generated ID in the DTO.
        // different package sessions where the subject will be available
        String[] packageSessionIds = getPackageSessionIds(commaSeparatedPackageSessionIds);
        for (String packageSessionId : packageSessionIds) {
            try {
                PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                        .orElseThrow(() -> new VacademyException("Package Session not found"));

                if (getSubjectByNameAndPackageSessionId(subjectDTO.getSubjectName(), packageSessionId).isPresent()) {
                    throw new VacademyException("Subject already exists");
                }

                subjectPackageSessionRepository.save(new SubjectPackageSession(savedSubject, packageSession));
                // Create and save the relationship between the subject and the package session.
            } catch (Exception e) {
                log.error("Error adding subject: {}", e.getMessage());
            }
        }
        return subjectDTO;
    }

    private String[] getPackageSessionIds(String commaSeparatedPackageSessionIds) {
        return commaSeparatedPackageSessionIds.split(",");
    }

    /**
     * Updates an existing subject.
     *
     * @param subjectDTO The DTO containing updated subject information.
     * @param subjectId   The ID of the subject to update.
     * @param user       The user who is updating the subject.
     * @return The updated subject DTO.
     * @throws VacademyException If the subject ID is null or the subject is not found.
     */
    public SubjectDTO updateSubject(SubjectDTO subjectDTO,String subjectId,CustomUserDetails user) {
        if (Objects.isNull(subjectId)){
            throw new VacademyException("Subject id can not be null");
        }
        Subject subject = subjectRepository.findById(subjectId).get();
        if (Objects.isNull(subject)){
            throw new VacademyException("Subject not found");
        }
        subjectDTO.setId(subjectId);
        createSubject(subjectDTO,subject);
        subjectRepository.save(subject);
        return subjectDTO;
    }

    /**
     * Deletes a subject by marking it as deleted.
     *
     * @param subjectId The ID of the subject to delete.
     * @param user       The user who is deleting the subject.
     * @return A message indicating successful deletion.
     * @throws VacademyException If the subject ID is null or the subject is not found.
     */
    public String deleteSubject(String subjectId,CustomUserDetails user) {
        if (Objects.isNull(subjectId)){
            throw new VacademyException("Subject id can not be null");
        }
        Subject subject = subjectRepository.findById(subjectId).get();
        if (Objects.isNull(subject)){
            throw new VacademyException("Subject not found");
        }
        subject.setStatus(SubjectStatusEnum.DELETED.name());
        subjectRepository.save(subject);
        return "Subject deleted successfully";
    }

    void validateSubject(SubjectDTO subjectDTO) {
        if (subjectDTO == null) {
            throw new VacademyException("SubjectDTO is null");
        }
        if (subjectDTO.getSubjectName() == null) {
            throw new VacademyException("Subject Name can not be null");
        }
    }
    private void createSubject(SubjectDTO subjectDTO,Subject subject) {
        if (subjectDTO.getId() != null) {
            subject.setId(subjectDTO.getId());
        }
        if (subjectDTO.getSubjectName() != null){
            subject.setSubjectName(subjectDTO.getSubjectName());
        }
        if (subjectDTO.getSubjectCode() != null){
            subject.setSubjectCode(subjectDTO.getSubjectCode());
        }
        if (subjectDTO.getCredit() != null){
            subject.setCredit(subjectDTO.getCredit());
        }
        if (subjectDTO.getThumbnailId() != null){
            subject.setThumbnailId(subjectDTO.getThumbnailId());
        }
        subject.setStatus(SubjectStatusEnum.ACTIVE.name());
    }

    public Optional<Subject> getSubjectByNameAndPackageSessionId(String subjectName, String packageSessionId) {
        return subjectPackageSessionRepository.findSubjectByNameAndPackageSessionId(subjectName, packageSessionId);
    }

    public void saveSubjectModuleMapping(Subject subject, Module module){
        subjectModuleMappingRepository.save(new SubjectModuleMapping(subject,module));
    }

    @Transactional
    public String updateSubjectOrder(List<UpdateSubjectOrderDTO> updateSubjectOrderDTOS, CustomUserDetails user) {
        if (updateSubjectOrderDTOS == null || updateSubjectOrderDTOS.isEmpty()) {
            throw new IllegalArgumentException("No subject order updates provided.");
        }

        // Fetch all mappings once
        List<SubjectPackageSession> subjectPackageSessions = subjectPackageSessionRepository
                .findBySubjectIdInAndPackageSessionIdIn(
                        updateSubjectOrderDTOS.stream().map(UpdateSubjectOrderDTO::getSubjectId).collect(Collectors.toList()),
                        updateSubjectOrderDTOS.stream().map(UpdateSubjectOrderDTO::getPackageSessionId).collect(Collectors.toList())
                );

        // Create a map of the SubjectPackageSession based on the subjectId and packageSessionId
        Map<String, SubjectPackageSession> mappingMap = subjectPackageSessions.stream()
                .collect(Collectors.toMap(
                        session -> session.getSubject().getId() + "-" + session.getPackageSession().getId(),
                        session -> session
                ));

        // Update the subject order using the map
        updateSubjectOrderDTOS.forEach(updateDTO -> {
            String key = updateDTO.getSubjectId() + "-" + updateDTO.getPackageSessionId();
            SubjectPackageSession subjectPackageSession = mappingMap.get(key);

            if (subjectPackageSession == null) {
                throw new RuntimeException("Mapping not found for subjectId: " + updateDTO.getSubjectId() +
                        " and packageSessionId: " + updateDTO.getPackageSessionId());
            }

            if (updateDTO.getSubjectOrder() == null || updateDTO.getSubjectOrder() <= 0) {
                throw new IllegalArgumentException("Invalid subject order for subjectId: " + updateDTO.getSubjectId());
            }

            subjectPackageSession.setSubjectOrder(updateDTO.getSubjectOrder());
        });

        // Batch save all updated mappings
        subjectPackageSessionRepository.saveAll(subjectPackageSessions);

        return "Subject order updated successfully.";
    }
}