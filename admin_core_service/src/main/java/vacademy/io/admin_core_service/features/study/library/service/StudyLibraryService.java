package vacademy.io.admin_core_service.features.study.library.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.level.repository.LevelRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.study.library.dto.LevelDTOWithDetails;
import vacademy.io.admin_core_service.features.study.library.dto.SessionDTOWithDetails;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectChapterModuleAndPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SessionDTO;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.LevelProjection;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.SessionProjection;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class StudyLibraryService {

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private LevelRepository levelRepository;

    public List<SessionDTOWithDetails> getStudyLibraryInitDetails(String instituteId) {
        if (Objects.isNull(instituteId)) {
            throw new VacademyException("Please provide instituteId");
        }
        List<SessionProjection> packageSessions = packageRepository.findDistinctSessionsByInstituteId(instituteId);
        List<SessionDTOWithDetails> sessionDTOWithDetails = new ArrayList<>();
        for(SessionProjection sessionProjection : packageSessions) {
            List<LevelDTOWithDetails> levelWithDetails = new ArrayList<>();
            List<Level>levels = levelRepository.findDistinctLevelsByInstituteIdAndSessionId(instituteId, sessionProjection.getId());
            for (Level level: levels) {
                List<Subject> subjects = subjectRepository.findDistinctSubjectsByLevelId(level.getId());
                LevelDTOWithDetails levelDTOWithDetails = getLevelDTOWithDetails(subjects, level);
                levelWithDetails.add(levelDTOWithDetails);
            }
            sessionDTOWithDetails.add(getSessionDTOWithDetails(sessionProjection, levelWithDetails));
        }
        return sessionDTOWithDetails;
    }

    public LevelDTOWithDetails getLevelDTOWithDetails(List<Subject> subjects, Level level) {
        List<SubjectDTO> subjectDTOS = new ArrayList<>();
        for (Subject subject : subjects) {
            SubjectDTO subjectDTO = new SubjectDTO();
            subjectDTO.setId(subject.getId());
            subjectDTO.setSubjectName(subject.getSubjectName());
            subjectDTO.setSubjectCode(subject.getSubjectCode());
            subjectDTO.setCredit(subject.getCredit());
            subjectDTOS.add(subjectDTO);
        }
        LevelDTOWithDetails levelDTOWithDetails = new LevelDTOWithDetails(level, subjectDTOS);
        return levelDTOWithDetails;
    }

    public SessionDTOWithDetails getSessionDTOWithDetails(SessionProjection sessionProjection, List<LevelDTOWithDetails> levelWithDetails) {
        SessionDTOWithDetails sessionDTOWithDetails = new SessionDTOWithDetails();
        SessionDTO sessionDTO = new SessionDTO(sessionProjection);
        sessionDTOWithDetails.setLevelWithDetails(levelWithDetails);
        sessionDTOWithDetails.setSessionDTO(sessionDTO);
        return sessionDTOWithDetails;
    }
}
