package vacademy.io.admin_core_service.features.slide.service;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.slide.dto.SlideMetadataProjection;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SlideMetaDataService {

    private final SlideRepository slideMetadataRepository;

    private static final List<String> ACTIVE_SUBJECTS = List.of(SubjectStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_MODULES = List.of(ModuleStatusEnum.ACTIVE.name());
    private static final List<String> ACTIVE_CHAPTERS = List.of(ChapterStatus.ACTIVE.name());
    private static final List<String> VALID_SLIDE_STATUSES = List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name());
    private static final List<String> SLIDE_TYPES = List.of(SlideTypeEnum.VIDEO.name(), SlideTypeEnum.DOCUMENT.name(),SlideTypeEnum.ASSIGNMENT.name(),SlideTypeEnum.QUESTION.name());
    private static final List<String> VALID_SLIDE_STATUSES_FOR_ADMIN = List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name(),SlideStatus.DRAFT.name());

    public Optional<SlideMetadataProjection> getSlideMetadataForLearner(String slideId) {
        return slideMetadataRepository.findSlideMetadataBySlideId(
                slideId,
                ACTIVE_SUBJECTS,
                ACTIVE_MODULES,
                ACTIVE_CHAPTERS,
                ACTIVE_CHAPTERS,
                VALID_SLIDE_STATUSES
        );
    }

    public Optional<SlideMetadataProjection> getSlideMetadataForAdmin(String slideId) {
        return slideMetadataRepository.findSlideMetadataBySlideId(
                slideId,
                ACTIVE_SUBJECTS,
                ACTIVE_MODULES,
                ACTIVE_CHAPTERS,
                ACTIVE_CHAPTERS,
                VALID_SLIDE_STATUSES_FOR_ADMIN
        );
    }
}
