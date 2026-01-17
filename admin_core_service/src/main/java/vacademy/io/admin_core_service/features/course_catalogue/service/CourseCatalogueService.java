package vacademy.io.admin_core_service.features.course_catalogue.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CourseCatalogueRequest;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CourseCatalogueResponse;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CatalogueInstituteMapping;
import vacademy.io.admin_core_service.features.course_catalogue.entity.CourseCatalogue;
import vacademy.io.admin_core_service.features.course_catalogue.enums.CatalogueStatusEnum;
import vacademy.io.admin_core_service.features.course_catalogue.repository.CatalogueInstituteMappingRepository;
import vacademy.io.admin_core_service.features.course_catalogue.repository.CourseCatalogueRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CourseCatalogueService {

    @Autowired
    private CourseCatalogueRepository courseCatalogueRepository;

    @Autowired
    private CatalogueInstituteMappingRepository catalogueInstituteMappingRepository;

    @Transactional
    public List<CourseCatalogueResponse> createCatalogues(List<CourseCatalogueRequest> requests, String instituteId,
            Institute institute) {
        List<CourseCatalogueResponse> responses = new ArrayList<>();

        for (CourseCatalogueRequest request : requests) {
            // Enforce uniqueness of (instituteId, tagName) among ACTIVE mappings
            if (request.getTagName() != null && !request.getTagName().isBlank()) {
                Optional<CatalogueInstituteMapping> existing = catalogueInstituteMappingRepository
                        .findByInstituteIdAndTagName(instituteId, request.getTagName(),
                                List.of(CatalogueStatusEnum.ACTIVE.name()));
                if (existing.isPresent()) {
                    throw new VacademyException(HttpStatus.CONFLICT, "Catalogue tag already exists for this institute");
                }
            }
            CourseCatalogue catalogue = CourseCatalogue.builder()
                    .catalogueJson(request.getCatalogueJson())
                    .tagName(request.getTagName())
                    .status(request.getStatus())
                    .build();
            catalogue = courseCatalogueRepository.save(catalogue);

            CatalogueInstituteMapping mapping = CatalogueInstituteMapping.builder()
                    .courseCatalogue(catalogue)
                    .institute(institute)
                    .source(request.getSource())
                    .sourceId(request.getSourceId())
                    .status(request.getStatus())
                    .isDefault(request.getIsDefault())
                    .build();
            catalogueInstituteMappingRepository.save(mapping);

            responses.add(
                    CourseCatalogueResponse.builder()
                            .id(catalogue.getId())
                            .catalogueJson(catalogue.getCatalogueJson())
                            .tagName(catalogue.getTagName())
                            .status(catalogue.getStatus())
                            .source(mapping.getSource())
                            .sourceId(mapping.getSourceId())
                            .instituteId(instituteId)
                            .build());
        }
        return responses;
    }

    @Transactional
    public CourseCatalogueResponse updateCatalogue(String catalogueId, CourseCatalogueRequest request) {
        Optional<CourseCatalogue> optional = courseCatalogueRepository.findById(catalogueId);
        if (optional.isEmpty()) {
            throw new RuntimeException("Catalogue not found");
        }

        CourseCatalogue catalogue = optional.get();
        catalogue.setCatalogueJson(request.getCatalogueJson());
        catalogue.setTagName(request.getTagName());
        catalogue.setStatus(request.getStatus());
        catalogue = courseCatalogueRepository.save(catalogue);

        Optional<CatalogueInstituteMapping> mapping = catalogueInstituteMappingRepository
                .findByCourseCatalogueId(catalogueId);
        if (mapping.isEmpty())
            throw new VacademyException(HttpStatus.NOT_FOUND, "Catalogue Not Found");

        mapping.get().setStatus(request.getStatus());
        mapping.get().setSource(request.getSource());
        mapping.get().setSourceId(request.getSourceId());
        mapping.get().setIsDefault(request.getIsDefault());
        catalogueInstituteMappingRepository.save(mapping.get());

        return CourseCatalogueResponse.builder()
                .id(catalogue.getId())
                .catalogueJson(catalogue.getCatalogueJson())
                .tagName(catalogue.getTagName())
                .status(catalogue.getStatus())
                .source(mapping.get().getSource())
                .sourceId(mapping.get().getSourceId())
                .instituteId(mapping.get().getInstitute().getId())
                .isDefault(mapping.get().getIsDefault())
                .build();
    }

    public List<CourseCatalogueResponse> getAllCataloguesByInstitute(String instituteId) {
        List<CatalogueInstituteMapping> mappings = catalogueInstituteMappingRepository
                .findByInstituteIdAndStatusIn(instituteId, List.of(CatalogueStatusEnum.ACTIVE.name()));

        return mappings.stream()
                .map(m -> CourseCatalogueResponse.builder()
                        .id(m.getCourseCatalogue().getId())
                        .catalogueJson(m.getCourseCatalogue().getCatalogueJson())
                        .tagName(m.getCourseCatalogue().getTagName())
                        .status(m.getCourseCatalogue().getStatus())
                        .source(m.getSource())
                        .sourceId(m.getSourceId())
                        .instituteId(m.getInstitute().getId())
                        .build())
                .collect(Collectors.toList());
    }

    public List<CourseCatalogueResponse> getCataloguesForInstituteAndSourceAndSourceId(String instituteId,
            String source, String sourceId) {
        List<CatalogueInstituteMapping> mappings = catalogueInstituteMappingRepository
                .findByInstituteIdAndSourceAndSourceIdAndStatusIn(instituteId, source, sourceId,
                        List.of(CatalogueStatusEnum.ACTIVE.name()));
        return mappings.stream()
                .map(m -> CourseCatalogueResponse.builder()
                        .id(m.getCourseCatalogue().getId())
                        .catalogueJson(m.getCourseCatalogue().getCatalogueJson())
                        .tagName(m.getCourseCatalogue().getTagName())
                        .status(m.getCourseCatalogue().getStatus())
                        .source(m.getSource())
                        .sourceId(m.getSourceId())
                        .instituteId(m.getInstitute().getId())
                        .build())
                .collect(Collectors.toList());
    }

    public CourseCatalogueResponse getDefaultCatalogueForInstituteId(String instituteId) {
        Optional<CatalogueInstituteMapping> catalogueInstituteMappingOptional = catalogueInstituteMappingRepository
                .findDefaultCatalogueForInstituteId(instituteId, List.of(CatalogueStatusEnum.ACTIVE.name()));
        if (catalogueInstituteMappingOptional.isEmpty())
            throw new VacademyException("No Default Catalogue Found");
        CatalogueInstituteMapping mapping = catalogueInstituteMappingOptional.get();

        return CourseCatalogueResponse.builder()
                .id(mapping.getCourseCatalogue().getId())
                .catalogueJson(mapping.getCourseCatalogue().getCatalogueJson())
                .tagName(mapping.getCourseCatalogue().getTagName())
                .status(mapping.getCourseCatalogue().getStatus())
                .source(mapping.getSource())
                .sourceId(mapping.getSourceId())
                .instituteId(mapping.getInstitute().getId())
                .build();
    }

    public CourseCatalogueResponse getCatalogueByInstituteAndTag(String instituteId, String tagName) {
        Optional<CatalogueInstituteMapping> mappingOpt = catalogueInstituteMappingRepository
                .findByInstituteIdAndTagName(instituteId, tagName, List.of(CatalogueStatusEnum.ACTIVE.name()));
        if (mappingOpt.isEmpty()) {
            throw new VacademyException(HttpStatus.NOT_FOUND, "Catalogue not found for tag");
        }
        CatalogueInstituteMapping mapping = mappingOpt.get();
        return CourseCatalogueResponse.builder()
                .id(mapping.getCourseCatalogue().getId())
                .catalogueJson(mapping.getCourseCatalogue().getCatalogueJson())
                .tagName(mapping.getCourseCatalogue().getTagName())
                .status(mapping.getCourseCatalogue().getStatus())
                .source(mapping.getSource())
                .sourceId(mapping.getSourceId())
                .instituteId(mapping.getInstitute().getId())
                .build();
    }
}
