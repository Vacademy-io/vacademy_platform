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
        public InstituteInfoDTO getInstituteDetails(String instituteId) {
                return buildInstituteInfoDTO(instituteId, true);
        }

        @Transactional
        public InstituteInfoDTO getPublicInstituteDetails(String instituteId) {
                return buildInstituteInfoDTO(instituteId, false);
        }

        /**
         * Builds InstituteInfoDTO with common logic for both public and private access
         * 
         * @param instituteId          The institute ID
         * @param includePrivateFields Whether to include private fields (email, phone,
         *                             subjects, etc.)
         * @return Populated InstituteInfoDTO
         */
        private InstituteInfoDTO buildInstituteInfoDTO(String instituteId, boolean includePrivateFields) {
                Institute institute = instituteRepository.findById(instituteId)
                                .orElseThrow(() -> new VacademyException("Invalid Institute Id"));

                InstituteInfoDTO dto = new InstituteInfoDTO();

                // Basic institute information
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

                // Fetch related data from repositories
                String instId = institute.getId();
                List<String> activeStatuses = List.of(PackageSessionStatusEnum.ACTIVE.name());

                dto.setSubModules(instituteModuleService.getSubmoduleIdsForInstitute(instId));
                dto.setTags(packageRepository.findAllDistinctTagsByInstituteId(instId));
                dto.setSessions(packageRepository.findDistinctSessionsByInstituteIdAndStatusIn(instId, activeStatuses)
                                .stream().map(SessionDTO::new).toList());
                dto.setLevels(packageRepository.findDistinctLevelsByInstituteIdAndStatusIn(instId, activeStatuses)
                                .stream().map(LevelDTO::new).toList());
                dto.setPackageGroups(packageGroupMappingRepository.findAllByInstituteId(instId)
                                .stream().map(obj -> obj.mapToDTO()).toList());

                // OPTIMIZATION: Fetch all package sessions first, then batch query read times
                List<PackageSession> packageSessions = packageSessionRepository.findPackageSessionsByInstituteId(instId,
                                activeStatuses);

                // Batch query to get all read times at once (eliminates N+1 query problem)
                List<String> sessionIds = packageSessions.stream().map(PackageSession::getId).toList();
                Map<String, Double> readTimeMap = slideService.calculateReadTimesForPackageSessions(sessionIds);

                // Map package sessions to DTOs with read times from the batch result
                dto.setBatchesForSessions(packageSessions.stream()
                                .map(obj -> new PackageSessionDTO(obj,
                                                readTimeMap.getOrDefault(obj.getId(), 0.0).doubleValue()))
                                .toList());

                // Private fields that require additional queries
                if (includePrivateFields) {
                        dto.setGenders(Stream.of(Gender.values()).map(Enum::name).toList());
                        dto.setStudentStatuses(List.of("ACTIVE", "INACTIVE"));
                        dto.setSubjects(subjectRepository.findDistinctSubjectsByInstituteId(instId)
                                        .stream().map(SubjectDTO::new).toList());
                        dto.setSessionExpiryDays(List.of(30, 180, 360));
                }

                return dto;
        }


        private InstituteInfoDTOForTableSetup buildInstituteInfoDTOForTableSetup(String instituteId, boolean includePrivateFields) {
                Institute institute = instituteRepository.findById(instituteId)
                        .orElseThrow(() -> new VacademyException("Invalid Institute Id"));
                InstituteInfoDTOForTableSetup idto=new InstituteInfoDTOForTableSetup();

                String instId = institute.getId();
                List<String> activeStatuses = List.of(PackageSessionStatusEnum.ACTIVE.name());

                idto.setTags(packageRepository.findAllDistinctTagsByInstituteId(instId));
                idto.setLevels(packageRepository.findDistinctLevelsByInstituteIdAndStatusIn(instId, activeStatuses)
                        .stream().map(LevelDTO::new).toList());
                idto.setPackageGroups(packageGroupMappingRepository.findAllByInstituteId(instId)
                        .stream().map(obj -> obj.mapToDTO()).toList());

                // OPTIMIZATION: Fetch all package sessions first, then batch query read times
                List<PackageSession> packageSessions = packageSessionRepository.findPackageSessionsByInstituteId(instId,
                        activeStatuses);

                // Batch query to get all read times at once (eliminates N+1 query problem)
                List<String> sessionIds = packageSessions.stream().map(PackageSession::getId).toList();
                Map<String, Double> readTimeMap = slideService.calculateReadTimesForPackageSessions(sessionIds);

                // Map package sessions to DTOs with read times from the batch result
                idto.setBatchesForSessions(packageSessions.stream()
                        .map(obj -> new PackageSessionDTO(obj,
                                readTimeMap.getOrDefault(obj.getId(), 0.0).doubleValue()))
                        .toList());

                // Private fields that require additional queries
                if (includePrivateFields) {
                        idto.setGenders(Stream.of(Gender.values()).map(Enum::name).toList());
                        idto.setStudentStatuses(List.of("ACTIVE", "INACTIVE"));
                        idto.setSessionExpiryDays(List.of(30, 180, 360));
                }

                return idto;
        }



        @Transactional
        public InstituteSetupDTO getInstituteSetupDetails(String instituteId) {

                InstituteInfoDTOForTableSetup instituteInfoDTOForTableSetup=buildInstituteInfoDTOForTableSetup(instituteId,true);
                
                // Get active dropdown custom fields
                List<CustomFieldDTO> dropdownCustomFields = instituteCustomFiledService
                        .getActiveDropdownCustomFields(instituteId);
                
                // Build and return setup DTO
                return InstituteSetupDTO.builder()
                        .instituteInfoDTO(instituteInfoDTOForTableSetup)
                        .dropdownCustomFields(dropdownCustomFields)
                        .subOrgRoles(List.of(SubOrgRoles.LEARNER, SubOrgRoles.ADMIN,SubOrgRoles.ROOT_ADMIN))
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
