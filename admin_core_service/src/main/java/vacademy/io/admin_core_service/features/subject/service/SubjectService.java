package vacademy.io.admin_core_service.features.subject.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.entity.SubjectModuleMapping;
import vacademy.io.admin_core_service.features.subject.entity.SubjectPackageSession;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.admin_core_service.features.subject.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectPackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SubjectService {
    private final SubjectRepository subjectRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final SubjectPackageSessionRepository subjectPackageSessionRepository;
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;

    public SubjectDTO addSubject(SubjectDTO subjectDTO, String commaSeparatedPackageSessionIds, CustomUserDetails user) {
        if (Objects.isNull(commaSeparatedPackageSessionIds)) {
            throw new VacademyException("Package Session Id cannot be null");
        }

        validateSubject(subjectDTO);
        Subject subject = new Subject();
        createSubject(subjectDTO, subject);
        Subject savedSubject = subjectRepository.save(subject);
        subjectDTO.setId(savedSubject.getId());
        String[] packageSessionIds = getPackageSessionIds(commaSeparatedPackageSessionIds);
        for (String packageSessionId : packageSessionIds) {
            try {
                PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                        .orElseThrow(() -> new VacademyException("Package Session not found"));

                if (getSubjectByNameAndPackageSessionId(subjectDTO.getSubjectName(), packageSessionId).isPresent()) {
                    throw new VacademyException("Subject already exists");
                }

                subjectPackageSessionRepository.save(new SubjectPackageSession(savedSubject, packageSession));
            } catch (Exception e) {

            }
        }
        return subjectDTO;
    }

    private String[] getPackageSessionIds(String commaSeparatedPackageSessionIds) {
        return commaSeparatedPackageSessionIds.split(",");
    }

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
}
