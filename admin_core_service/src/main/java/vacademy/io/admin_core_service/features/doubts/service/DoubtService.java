package vacademy.io.admin_core_service.features.doubts.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterToSlides;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterToSlidesRepository;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtAssigneeDto;
import vacademy.io.admin_core_service.features.doubts.dtos.DoubtsDto;
import vacademy.io.admin_core_service.features.doubts.entity.DoubtAssignee;
import vacademy.io.admin_core_service.features.doubts.entity.Doubts;
import vacademy.io.admin_core_service.features.doubts.enums.DoubtAssigneeStatusEnum;
import vacademy.io.admin_core_service.features.doubts.enums.DoubtStatusEnum;
import vacademy.io.admin_core_service.features.doubts.enums.DoubtsSourceEnum;
import vacademy.io.admin_core_service.features.doubts.repository.DoubtsAssigneeRepository;
import vacademy.io.admin_core_service.features.doubts.repository.DoubtsRepository;
import vacademy.io.admin_core_service.features.module.service.ModuleService;
import vacademy.io.admin_core_service.features.slide.dto.SlideMetadataProjection;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.slide.service.SlideMetaDataService;
import vacademy.io.common.institute.entity.module.Module;

import java.util.*;

@Slf4j
@Service
public class DoubtService {

    @Autowired
    DoubtsRepository doubtsRepository;

    @Autowired
    DoubtsAssigneeRepository doubtsAssigneeRepository;

    @Autowired
    SlideRepository slideRepository;

    @Autowired
    private SlideMetaDataService slideMetaDataService;

    @Autowired
    private ModuleService moduleService;

    @Autowired
    private ChapterToSlidesRepository chapterToSlidesRepository;

    public Optional<Doubts> getDoubtById(String id){
        return doubtsRepository.findById(id);
    }

    public Doubts updateOrCreateDoubt(Doubts doubts){
        return doubtsRepository.save(doubts);
    }

    public List<DoubtAssignee> saveOrUpdateDoubtsAssignee(List<DoubtAssignee> allAssignees){
        return doubtsAssigneeRepository.saveAll(allAssignees);
    }


    public Page<Doubts> getAllDoubtsWithFilter(List<String> contentTypes,
                                               List<String> contentPositions,
                                               List<String> sources,
                                               List<String> sourceIds,
                                               Date startDate,
                                               Date endDate,
                                               List<String> userIds,
                                               List<String> status,
                                               List<String> batchIds,
                                               Pageable pageable) {
        List<String> filteredContentTypes = Optional.ofNullable(contentTypes).orElse(Collections.emptyList());
        List<String> filteredContentPositions = Optional.ofNullable(contentPositions).orElse(Collections.emptyList());
        List<String> filteredSources = Optional.ofNullable(sources).orElse(Collections.emptyList());
        List<String> filteredSourceIds = Optional.ofNullable(sourceIds).orElse(Collections.emptyList());
        List<String> filteredUserIds = Optional.ofNullable(userIds).orElse(Collections.emptyList());
        List<String> filteredStatus = Optional.ofNullable(status).orElse(Collections.emptyList());
        List<String> filteredBatchIds = Optional.ofNullable(batchIds).orElse(Collections.emptyList());

        return doubtsRepository.findDoubtsWithFilter(filteredContentPositions,filteredContentTypes,filteredSources,filteredSourceIds,filteredUserIds,filteredStatus,filteredBatchIds,startDate,endDate,pageable);
    }

    public List<DoubtsDto> createDtoFromDoubts(List<Doubts> allDoubts) {
        if(allDoubts == null || allDoubts.isEmpty()) return new ArrayList<>();

        List<DoubtsDto> response = new ArrayList<>();
        allDoubts.forEach(doubt -> {
            // Recursively fetch all replies
            List<Doubts> childDoubts = doubtsRepository.findByParentIdAndStatusNotIn(
                    doubt.getId(), List.of(DoubtStatusEnum.DELETED.name())
            );

            List<DoubtAssigneeDto> allAssigneeDto = new ArrayList<>();
            String moduleId = null;
            String chapterId = null;

            if(doubt.getParentId() == null){
                allAssigneeDto = getAssigneeDtoFromDoubt(doubt);
                Optional<Module> module = moduleService.getModuleBySlideIdAndPackageSessionIdWithStatusFilters(doubt.getSourceId(), doubt.getPackageSessionId());
                if(module.isPresent()){
                    moduleId = module.get().getId();
                }

                Optional<ChapterToSlides> chapterToSlides = chapterToSlidesRepository.findBySlideId(doubt.getSourceId());
                if(chapterToSlides.isPresent()) chapterId = chapterToSlides.get().getChapter().getId();
            }

            String subjectId = null;
            String sourceName = null;

            if (DoubtsSourceEnum.SLIDE.name().equals(doubt.getSource())) {
                Optional<Slide> slideOptional = slideRepository.findById(doubt.getSourceId());
                if (slideOptional.isPresent()) {
                    sourceName = slideOptional.get().getTitle();

                    Optional<SlideMetadataProjection> slideMetadataProjection = slideMetaDataService.getSlideMetadataForAdmin(doubt.getSourceId());
                    if(slideMetadataProjection.isPresent()){
                        subjectId = slideMetadataProjection.get().getSubjectId();
                    }
                }
            }

            response.add(DoubtsDto.builder()
                    .id(doubt.getId())
                    .userId(doubt.getUserId())
                    .contentPosition(doubt.getContentPosition())
                    .contentType(doubt.getContentType())
                    .htmlText(doubt.getHtmlText())
                    .parentId(doubt.getParentId())
                    .parentLevel(doubt.getParentLevel()==null ? 0 : doubt.getParentLevel())
                    .source(doubt.getSource())
                    .sourceId(doubt.getSourceId())
                    .subjectId(subjectId)
                    .sourceName(sourceName)
                    .batchId(doubt.getPackageSessionId())
                    .status(doubt.getStatus())
                    .resolvedTime(doubt.getResolvedTime())
                    .raisedTime(doubt.getRaisedTime())
                    .allDoubtAssignee(allAssigneeDto)
                    .moduleId(moduleId)
                    .chapterId(chapterId)
                    .replies(createDtoFromDoubts(childDoubts)) // recursive call here
                    .build());
        });
        return response;
    }

    private List<DoubtAssigneeDto> getAssigneeDtoFromDoubt(Doubts doubt) {
        List<DoubtAssignee> allAssignee = doubtsAssigneeRepository.findByDoubtIdAndStatusNotIn(doubt.getId(), List.of(DoubtAssigneeStatusEnum.DELETED.name()));
        List<DoubtAssigneeDto> response = new ArrayList<>();
        allAssignee.forEach(assignee->{
            response.add(assignee.getAssigneeDto());
        });

        return response;
    }

    public void deleteAssigneeForDoubt(List<String> deleteAssigneeRequest) {
        if(deleteAssigneeRequest.isEmpty()) return;
        List<DoubtAssignee> allAssignee = doubtsAssigneeRepository.findAllById(deleteAssigneeRequest);

        allAssignee.forEach(assignee->{
            assignee.setStatus(DoubtAssigneeStatusEnum.DELETED.name());
        });

        doubtsAssigneeRepository.saveAll(allAssignee);
    }
}
