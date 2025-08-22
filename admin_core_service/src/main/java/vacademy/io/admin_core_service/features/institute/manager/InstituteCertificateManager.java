package vacademy.io.admin_core_service.features.institute.manager;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.dto.CertificationGenerationRequest;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.media.dto.FileDetailsDTO;

import java.util.Optional;

@Component
public class InstituteCertificateManager {

    private final InstituteSettingService instituteSettingService;
    private final StudentSessionInstituteGroupMappingRepository studentSessionInstituteGroupMappingRepository;
    private final InstituteRepository instituteRepository;

    public InstituteCertificateManager(InstituteSettingService instituteSettingService, StudentSessionInstituteGroupMappingRepository studentSessionInstituteGroupMappingRepository, InstituteRepository instituteRepository) {
        this.instituteSettingService = instituteSettingService;
        this.studentSessionInstituteGroupMappingRepository = studentSessionInstituteGroupMappingRepository;
        this.instituteRepository = instituteRepository;
    }

    public ResponseEntity<String> generateAutomatedCourseCompletionCertificate(CustomUserDetails userDetails, String learnerId, String packageSessionId, String instituteId, CertificationGenerationRequest request) {
        Optional<StudentSessionInstituteGroupMapping> instituteStudentMapping = studentSessionInstituteGroupMappingRepository.findByUserIdAndPackageSessionIdAndInstituteId(learnerId, packageSessionId, instituteId);
        if(instituteStudentMapping.isEmpty()) throw new VacademyException(HttpStatus.NOT_FOUND, "Student Mapping Not Present");

        if(!StringUtils.hasText(instituteStudentMapping.get().getAutomatedCompletionCertificateFileId())){
            return handleCaseWhereCertificateNotPresent(learnerId,packageSessionId,instituteId, instituteStudentMapping, request);
        }

        return new ResponseEntity<>(instituteStudentMapping.get().getAutomatedCompletionCertificateFileId(), HttpStatus.ACCEPTED);
    }

    private ResponseEntity<String> handleCaseWhereCertificateNotPresent(String learnerId, String packageSessionId, String instituteId, Optional<StudentSessionInstituteGroupMapping> instituteStudentMapping, CertificationGenerationRequest request) {
        Optional<FileDetailsDTO> file = instituteSettingService.ifEligibleForCourseCertificationForUserAndPackageSession(learnerId,packageSessionId,instituteId,instituteStudentMapping, request);
        if(instituteStudentMapping.isEmpty()) throw new VacademyException("Mapping Not Found");
        if(file.isEmpty()) throw new VacademyException(HttpStatus.NOT_FOUND, "Failed To Fetch Certificate");

        instituteStudentMapping.get().setAutomatedCompletionCertificateFileId(file.get().getId());
        studentSessionInstituteGroupMappingRepository.save(instituteStudentMapping.get());
        return new ResponseEntity<>(file.get().getId(), HttpStatus.OK);
    }

    public ResponseEntity<String> updateCurrentCertificateTemplate(CustomUserDetails userDetails, String instituteId, CertificationGenerationRequest request) {
        try{
            Optional<Institute> institute = instituteRepository.findById(instituteId);
            if(institute.isEmpty()) throw new VacademyException(HttpStatus.NOT_FOUND, "Institute Not Found");

            return ResponseEntity.ok(instituteSettingService.updateInstituteCurrentTemplate(institute.get(), request));
        } catch (Exception e) {
            throw new VacademyException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed To Update Current Template");
        }
    }
}
