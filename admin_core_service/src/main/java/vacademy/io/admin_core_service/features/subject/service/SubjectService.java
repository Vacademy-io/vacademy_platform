package vacademy.io.admin_core_service.features.subject.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestBody;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.entity.SubjectPackageSession;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.admin_core_service.features.subject.repository.SubjectPackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.Objects;

@Service
@RequiredArgsConstructor
public class SubjectService {
    private final SubjectRepository subjectRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final SubjectPackageSessionRepository subjectPackageSessionRepository;


    public SubjectDTO addSubject(SubjectDTO subjectDTO, String packageSessionId, CustomUserDetails user) {
        if (Objects.isNull(packageSessionId)){
            throw new VacademyException("Package Session Id can not be null");
        }
        PackageSession packageSession = packageSessionRepository.findById(packageSessionId).get();
        if (Objects.isNull(packageSession)){
            throw new VacademyException("Package Session not found");
        }
        validateSubject(subjectDTO);
        Subject subject = new Subject();
        createSubject(subjectDTO,subject);
        Subject savedSubject = subjectRepository.save(subject);
        subjectPackageSessionRepository.save(new SubjectPackageSession(savedSubject,packageSession));
        subjectDTO.setId(savedSubject.getId());
        return subjectDTO;
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

}
