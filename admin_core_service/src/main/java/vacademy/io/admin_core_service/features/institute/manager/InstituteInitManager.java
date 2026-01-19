package vacademy.io.admin_core_service.features.institute.manager;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.enroll_invite.enums.SubOrgRoles;
import vacademy.io.admin_core_service.features.group.repository.PackageGroupMappingRepository;
import vacademy.io.admin_core_service.features.institute.dto.InstituteSetupDTO;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.InstituteModuleService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteInfoDTOForTableSetup;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.enums.Gender;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.*;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.session.PackageSession;

import vacademy.io.common.tracing.PerformanceTracer;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

@Component
public class InstituteInitManager {

        @Autowired
        InstituteModuleService instituteModuleService;
        @Autowired
        InstituteRepository instituteRepository;

        @Autowired
        PackageRepository packageRepository;

        @Autowired
        SubjectRepository subjectRepository;

        @Autowired
        PackageSessionRepository packageSessionRepository;

        @Autowired
        private PackageGroupMappingRepository packageGroupMappingRepository;

        @Autowired
        private SlideService slideService;

        @Autowired
        private InstituteCustomFiledService instituteCustomFiledService;

        @Transactional
        public InstituteInfoDTO getInstituteDetails(String instituteId, boolean includeBatches) {
                return buildInstituteInfoDTO(instituteId, true, includeBatches);
        }

        @Transactional
        public InstituteInfoDTO getPublicInstituteDetails(String instituteId, boolean includeBatches) {
                return buildInstituteInfoDTO(instituteId, false, includeBatches);
        }

        /**
         * Builds InstituteInfoDTO with common logic for both public and private access
         * 
         * @param instituteId          The institute ID
         * @param includePrivateFields Whether to include private fields (email, phone,
         *                             subjects, etc.)
         * @return Populated InstituteInfoDTO
         */
        private InstituteInfoDTO buildInstituteInfoDTO(String instituteId, boolean includePrivateFields, boolean includeBatches) {
                // Trace the main database lookup
                Institute institute = PerformanceTracer.traceDbQuery(
                                "instituteRepository.findById",
                                () -> instituteRepository.findById(instituteId)
                                                .orElseThrow(() -> new VacademyException("Invalid Institute Id")));

                InstituteInfoDTO dto = new InstituteInfoDTO();

                // Basic institute information (in-memory, fast)
                dto.setInstituteName(institute.getInstituteName());
                dto.setId(institute.getId());
                dto.setCity(institute.getCity());
                dto.setCountry(institute.getCountry());
                dto.setState(institute.getState());
                dto.setPinCode(institute.getPinCode());
                dto.setAddress(institute.getAddress());
                dto.setWebsiteUrl(institute.getWebsiteUrl());
                dto.setDescription(institute.getDescription());
                dto.setHeldBy(institute.getHeldBy());
                dto.setFoundedDate(institute.getFoundedData());
                dto.setType(institute.getInstituteType());
                dto.setLanguage(institute.getLanguage());
                dto.setInstituteThemeCode(institute.getInstituteThemeCode());

                // Portal URLs with defaults
                dto.setLearnerPortalBaseUrl(
                                Optional.ofNullable(institute.getLearnerPortalBaseUrl()).orElse("learner.vacademy.io"));
                dto.setTeacherPortalBaseUrl(
                                Optional.ofNullable(institute.getTeacherPortalBaseUrl()).orElse("teacher.vacademy.io"));
                dto.setAdminPortalBaseUrl(
                                Optional.ofNullable(institute.getAdminPortalBaseUrl()).orElse("dash.vacademy.io"));

                // File IDs
                dto.setInstituteLogoFileId(institute.getLogoFileId());
                dto.setCoverImageFileId(institute.getCoverImageFileId());
                dto.setCoverTextJson(institute.getCoverTextJson());
                dto.setSetting(institute.getSetting());

                // Private fields (email, phone, etc.)
                if (includePrivateFields) {
                        dto.setEmail(institute.getEmail());
                        dto.setPhone(institute.getMobileNumber());
                        dto.setLetterHeadFileId(institute.getLetterHeadFileId());
                }

                // Fetch related data from repositories - TRACE EACH QUERY
                String instId = institute.getId();
                List<String> activeStatuses = List.of(PackageSessionStatusEnum.ACTIVE.name());


                // Trace tags lookup
                dto.setTags(PerformanceTracer.traceDbQuery(
                                "packageRepository.findAllDistinctTagsByInstituteId",
                                () -> packageRepository.findAllDistinctTagsByInstituteId(instId)));

                // Trace sessions lookup
                dto.setSessions(PerformanceTracer.traceDbQuery(
                                "packageRepository.findDistinctSessionsByInstituteIdAndStatusIn",
                                () -> packageRepository
                                                .findDistinctSessionsByInstituteIdAndStatusIn(instId, activeStatuses)
                                                .stream().map(SessionDTO::new).toList()));

                // Trace levels lookup
                dto.setLevels(PerformanceTracer.traceDbQuery(
                                "packageRepository.findDistinctLevelsByInstituteIdAndStatusIn",
                                () -> packageRepository
                                                .findDistinctLevelsByInstituteIdAndStatusIn(instId, activeStatuses)
                                                .stream().map(LevelDTO::new).toList()));

                // Trace package groups lookup
                dto.setPackageGroups(PerformanceTracer.traceDbQuery(
                                "packageGroupMappingRepository.findAllByInstituteId",
                                () -> packageGroupMappingRepository.findAllByInstituteId(instId)
                                                .stream().map(obj -> obj.mapToDTO()).toList()));

                if(includeBatches){
                         // OPTIMIZATION: Fetch all package sessions first, then batch query read times
                List<PackageSession> packageSessions = PerformanceTracer.traceDbQuery(
                                "packageSessionRepository.findPackageSessionsByInstituteId",
                                () -> packageSessionRepository.findPackageSessionsByInstituteId(instId,
                                                activeStatuses));

                // Batch query to get all read times at once (eliminates N+1 query problem)
                List<String> sessionIds = packageSessions.stream().map(PackageSession::getId).toList();

                // This is likely the SLOWEST operation - trace it carefully
                Map<String, Double> readTimeMap = PerformanceTracer.trace(
                                "compute.heavy",
                                "slideService.calculateReadTimesForPackageSessions",
                                () -> slideService.calculateReadTimesForPackageSessions(sessionIds));

                // Map package sessions to DTOs with read times from the batch result
                dto.setBatchesForSessions(packageSessions.stream()
                                .map(obj -> new PackageSessionDTO(obj,
                                                readTimeMap.getOrDefault(obj.getId(), 0.0).doubleValue()))
                                .toList());

                }
                else{
                        dto.setBatchesForSessions(List.of());
                }

               
                // Private fields that require additional queries
                if (includePrivateFields) {
                        dto.setGenders(Stream.of(Gender.values()).map(Enum::name).toList());
                        dto.setStudentStatuses(List.of("ACTIVE", "INACTIVE"));

                        // Trace subjects lookup
                        dto.setSubjects(PerformanceTracer.traceDbQuery(
                                        "subjectRepository.findDistinctSubjectsByInstituteId",
                                        () -> subjectRepository.findDistinctSubjectsByInstituteId(instId)
                                                        .stream().map(SubjectDTO::new).toList()));
                        dto.setSessionExpiryDays(List.of(30, 180, 360));
                }

                return dto;
        }

        private InstituteInfoDTOForTableSetup buildInstituteInfoDTOForTableSetup(String instituteId,
                        boolean includePrivateFields, boolean includeBatches) {
                Institute institute = instituteRepository.findById(instituteId)
                                .orElseThrow(() -> new VacademyException("Invalid Institute Id"));
                InstituteInfoDTOForTableSetup idto = new InstituteInfoDTOForTableSetup();

                String instId = institute.getId();
                List<String> activeStatuses = List.of(PackageSessionStatusEnum.ACTIVE.name());

                idto.setTags(packageRepository.findAllDistinctTagsByInstituteId(instId));
                idto.setLevels(packageRepository.findDistinctLevelsByInstituteIdAndStatusIn(instId, activeStatuses)
                                .stream().map(LevelDTO::new).toList());
                idto.setPackageGroups(packageGroupMappingRepository.findAllByInstituteId(instId)
                                .stream().map(obj -> obj.mapToDTO()).toList());
                if (includeBatches) {

                        // OPTIMIZATION: Fetch all package sessions first, then batch query read times
                        List<PackageSession> packageSessions = packageSessionRepository
                                        .findPackageSessionsByInstituteId(instId,
                                                        activeStatuses);

                        // Batch query to get all read times at once (eliminates N+1 query problem)
                        List<String> sessionIds = packageSessions.stream().map(PackageSession::getId).toList();
                        Map<String, Double> readTimeMap = slideService.calculateReadTimesForPackageSessions(sessionIds);

                        // Map package sessions to DTOs with read times from the batch result
                        idto.setBatchesForSessions(packageSessions.stream()
                                        .map(obj -> new PackageSessionDTO(obj,
                                                        readTimeMap.getOrDefault(obj.getId(), 0.0).doubleValue()))
                                        .toList());
                } else {
                        idto.setBatchesForSessions(List.of());
                }

                // Private fields that require additional queries
                if (includePrivateFields) {
                        idto.setGenders(Stream.of(Gender.values()).map(Enum::name).toList());
                        idto.setStudentStatuses(List.of("ACTIVE", "INACTIVE", "INVITED", "PENDING_FOR_APPROVAL"));
                        idto.setSessionExpiryDays(List.of(30, 180, 360));
                }

                return idto;
        }

        @Transactional
        public InstituteSetupDTO getInstituteSetupDetails(String instituteId, boolean includeBatches) {

                InstituteInfoDTOForTableSetup instituteInfoDTOForTableSetup = buildInstituteInfoDTOForTableSetup(
                                instituteId, true, includeBatches);

                // Get active dropdown custom fields
                List<CustomFieldDTO> dropdownCustomFields = instituteCustomFiledService
                                .getActiveDropdownCustomFields(instituteId);

                // Build and return setup DTO
                return InstituteSetupDTO.builder()
                                .instituteInfoDTO(instituteInfoDTOForTableSetup)
                                .dropdownCustomFields(dropdownCustomFields)
                                .subOrgRoles(List.of(SubOrgRoles.LEARNER, SubOrgRoles.ADMIN, SubOrgRoles.ROOT_ADMIN))
                                .build();
        }

        public ResponseEntity<String> getInstituteIdOrSubDomain(String instituteId, String subdomain) {
                if (Objects.isNull(instituteId) && Objects.isNull(subdomain))
                        throw new VacademyException("Invalid Request");

                if (Objects.isNull(instituteId)) {
                        Optional<Institute> institute = instituteRepository.findBySubdomainLimit1(subdomain);
                        if (institute.isEmpty())
                                return ResponseEntity.ok("Data not found");
                        return ResponseEntity.ok(institute.get().getId());
                }

                Optional<Institute> institute = instituteRepository.findById(instituteId);
                if (institute.isEmpty())
                        return ResponseEntity.ok("Data not found");
                return ResponseEntity.ok(institute.get().getSubdomain());
        }
}
