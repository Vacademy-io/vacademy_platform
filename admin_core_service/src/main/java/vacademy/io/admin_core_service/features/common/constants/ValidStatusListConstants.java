package vacademy.io.admin_core_service.features.common.constants;

import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;

import java.util.List;

public class ValidStatusListConstants {
    public static final List<String> ACTIVE_LEARNERS = List.of(LearnerStatusEnum.ACTIVE.name());
    public static final List<String> ACTIVE_SUBJECTS = List.of(SubjectStatusEnum.ACTIVE.name());
    public static final List<String> ACTIVE_MODULES = List.of(ModuleStatusEnum.ACTIVE.name());
    public static final List<String> ACTIVE_CHAPTERS = List.of(ChapterStatus.ACTIVE.name());
    public static final List<String> VALID_SLIDE_STATUSES = List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name(),SlideStatus.DRAFT.name());
    public static final List<String> VALID_LEARNER_STATUSES = List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name());
    public static final List<String> SLIDE_TYPES = List.of(SlideTypeEnum.VIDEO.name(),SlideTypeEnum.DOCUMENT.name());
}
