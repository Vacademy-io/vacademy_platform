package vacademy.io.admin_core_service.features.slide.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.learner_tracking.service.LearnerTrackingAsyncService;
import vacademy.io.admin_core_service.features.slide.dto.HtmlVideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.entity.HtmlVideoSlide;
import vacademy.io.admin_core_service.features.slide.enums.SlideTypeEnum;
import vacademy.io.admin_core_service.features.slide.repository.HtmlVideoSlideRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Optional;

@Service
public class HtmlVideoSlideService {

    @Autowired
    private SlideService slideService;

    @Autowired
    private HtmlVideoSlideRepository htmlVideoSlideRepository;

    @Autowired
    private LearnerTrackingAsyncService learnerTrackingAsyncService;

    @Transactional
    public String addOrUpdateHtmlVideoSlide(SlideDTO slideDTO, String chapterId,
            String packageSessionId,
            String moduleId, String subjectId,
            CustomUserDetails userDetails) {
        String slideId = slideDTO.getId();
        if (slideDTO.isNewSlide()) {
            return addHtmlVideoSlide(slideDTO, chapterId);
        }
        updateHtmlVideoSlide(slideDTO, chapterId, moduleId, subjectId, packageSessionId);
        learnerTrackingAsyncService.updateLearnerOperationsForBatch("SLIDE", slideId, SlideTypeEnum.HTML_VIDEO.name(),
                chapterId, moduleId, subjectId, packageSessionId);
        return "success";
    }

    public String addHtmlVideoSlide(SlideDTO slideDTO, String chapterId) {
        HtmlVideoSlideDTO htmlVideoSlideDTO = slideDTO.getHtmlVideoSlide();
        if (htmlVideoSlideDTO == null) {
            throw new VacademyException("Html Video slide data is missing");
        }

        // Save base html video slide
        HtmlVideoSlide htmlVideoSlide = new HtmlVideoSlide(htmlVideoSlideDTO);
        htmlVideoSlide = htmlVideoSlideRepository.save(htmlVideoSlide);

        return slideService.saveSlide(
                slideDTO.getId(),
                htmlVideoSlide.getId(), // sourceId matches slideId in this case usually, or check logic
                SlideTypeEnum.HTML_VIDEO.name(), // sourceType
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId);
    }

    public String updateHtmlVideoSlide(SlideDTO slideDTO, String chapterId, String moduleId, String subjectId,
            String packageSessionId) {
        HtmlVideoSlideDTO htmlVideoSlideDTO = slideDTO.getHtmlVideoSlide();
        if (htmlVideoSlideDTO == null || !StringUtils.hasText(htmlVideoSlideDTO.getId())) {
            throw new VacademyException("Html Video slide ID is missing");
        }

        Optional<HtmlVideoSlide> optionalHtmlVideoSlide = htmlVideoSlideRepository.findById(htmlVideoSlideDTO.getId());
        if (optionalHtmlVideoSlide.isEmpty()) {
            throw new VacademyException("Html Video slide not found");
        }

        HtmlVideoSlide htmlVideoSlide = optionalHtmlVideoSlide.get();
        updateHtmlVideoSlideData(htmlVideoSlideDTO, htmlVideoSlide);
        htmlVideoSlideRepository.save(htmlVideoSlide);

        slideService.updateSlide(
                slideDTO.getId(),
                slideDTO.getStatus(),
                slideDTO.getTitle(),
                slideDTO.getDescription(),
                slideDTO.getImageFileId(),
                slideDTO.getSlideOrder(),
                chapterId,
                packageSessionId,
                moduleId,
                subjectId);

        return "success";
    }

    private void updateHtmlVideoSlideData(HtmlVideoSlideDTO dto, HtmlVideoSlide htmlVideoSlide) {
        if (StringUtils.hasText(dto.getUrl())) {
            htmlVideoSlide.setUrl(dto.getUrl());
        }
        if (dto.getVideoLengthInMillis() != null) {
            htmlVideoSlide.setVideoLengthInMillis(dto.getVideoLengthInMillis());
        }
        if (StringUtils.hasText(dto.getAiGenVideoId())) {
            htmlVideoSlide.setAiGenVideoId(dto.getAiGenVideoId());
        }
    }
}
