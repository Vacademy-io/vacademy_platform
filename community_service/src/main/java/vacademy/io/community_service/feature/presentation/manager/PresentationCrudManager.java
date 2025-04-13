package vacademy.io.community_service.feature.presentation.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.presentation.dto.question.AddPresentationDto;
import vacademy.io.community_service.feature.presentation.dto.question.EditPresentationDto;
import vacademy.io.community_service.feature.presentation.dto.question.PresentationSlideDto;
import vacademy.io.community_service.feature.presentation.dto.question.QuestionDTO;
import vacademy.io.community_service.feature.presentation.entity.Presentation;
import vacademy.io.community_service.feature.presentation.entity.PresentationSlide;
import vacademy.io.community_service.feature.presentation.entity.question.Question;
import vacademy.io.community_service.feature.presentation.repository.PresentationRepository;
import vacademy.io.community_service.feature.presentation.repository.PresentationSlideRepository;
import vacademy.io.community_service.feature.presentation.repository.QuestionRepository;

import java.util.*;

@Component
public class PresentationCrudManager {

    @Autowired
    PresentationRepository presentationRepository;

    @Autowired
    PresentationSlideRepository presentationSlideRepository;

    @Autowired
    AddQuestionManager addQuestionManager;

    @Autowired
    QuestionRepository questionRepository;


    public ResponseEntity<String> addPresentation(AddPresentationDto addPresentationDto, String instituteId) {
        Presentation newPresentation = createPresentation(addPresentationDto, instituteId);
        newPresentation = presentationRepository.save(newPresentation);

        List<PresentationSlideDto> questionSlides = new ArrayList<>();
        List<PresentationSlideDto> excalidrawSlides = new ArrayList<>();
        for (PresentationSlideDto presentationSlideDto : addPresentationDto.getAddedSlides()) {
            if (presentationSlideDto.getSource().equalsIgnoreCase("excalidraw")) {
                excalidrawSlides.add(presentationSlideDto);
            } else if (presentationSlideDto.getSource().equalsIgnoreCase("question")) {
                questionSlides.add(presentationSlideDto);
            }
        }

        addEditQuestionSlides(newPresentation, questionSlides);
        addEditExcalidrawSlides(newPresentation, excalidrawSlides);
        return ResponseEntity.ok(newPresentation.getId());
    }

    private Presentation createPresentation(AddPresentationDto addPresentationDto, String instituteId) {
        return Presentation.builder().title(addPresentationDto.getTitle()).coverFileId(addPresentationDto.getCoverFileId()).description(addPresentationDto.getDescription()).instituteId(instituteId).build();
    }

    private List<PresentationSlide> addEditQuestionSlides(Presentation presentation, List<PresentationSlideDto> questionSlides) {
        List<PresentationSlide> presentationSlides = new ArrayList<>();
        for (PresentationSlideDto presentationSlideDto : questionSlides) {
            PresentationSlide presentationSlide = null;
            if (presentationSlideDto.getId() != null) {
                presentationSlide = presentationSlideRepository.findById(presentationSlideDto.getId()).get();
                updatePresentationSlide(presentation, presentationSlideDto, presentationSlide);
            } else presentationSlide = createNewPresentationSlide(presentation, presentationSlideDto);
            if (presentationSlideDto.getAddedQuestion() != null) {
                List<Question> addedQuestions = addQuestionManager.addQuestions(List.of(presentationSlideDto.getAddedQuestion()));
                if (addedQuestions != null && !addedQuestions.isEmpty())
                    presentationSlide.setSourceId(addedQuestions.get(0).getId());
            }
            if (presentationSlideDto.getUpdatedQuestion() != null) {
                List<Question> updatedQuestions = addQuestionManager.saveEditQuestions(List.of(presentationSlideDto.getUpdatedQuestion()));
                if (updatedQuestions != null && !updatedQuestions.isEmpty())
                    presentationSlide.setSourceId(updatedQuestions.get(0).getId());
            }
            presentationSlides.add(presentationSlide);
        }

        return presentationSlideRepository.saveAll(presentationSlides);
    }

    private List<PresentationSlide> addEditExcalidrawSlides(Presentation presentation, List<PresentationSlideDto> excalidrawSlides) {
        List<PresentationSlide> presentationSlides = new ArrayList<>();
        for (PresentationSlideDto presentationSlideDto : excalidrawSlides) {
            PresentationSlide presentationSlide = null;
            if (presentationSlideDto.getId() != null) {
                presentationSlide = presentationSlideRepository.findById(presentationSlideDto.getId()).get();
                presentationSlide = updatePresentationSlide(presentation, presentationSlideDto, presentationSlide);
            } else presentationSlide = createNewPresentationSlide(presentation, presentationSlideDto);
            presentationSlides.add(presentationSlide);
        }

        return presentationSlideRepository.saveAll(presentationSlides);
    }

    private PresentationSlide createNewPresentationSlide(Presentation presentation, PresentationSlideDto presentationSlideDto) {
        PresentationSlide presentationSlide = new PresentationSlide();
        presentationSlide.setPresentation(presentation);
        presentationSlide.setTitle(presentationSlideDto.getTitle());
        presentationSlide.setSourceId(presentationSlideDto.getSourceId());
        presentationSlide.setSource(presentationSlideDto.getSource());
        presentationSlide.setInteractionStatus(presentationSlideDto.getInteractionStatus());
        presentationSlide.setDefaultTime(presentationSlideDto.getDefaultTime());
        presentationSlide.setStatus("PUBLISHED");
        presentationSlide.setContent(presentationSlideDto.getContent());
        presentationSlide.setSlideOrder(presentationSlideDto.getSlideOrder());
        return presentationSlide;
    }

    private PresentationSlide updatePresentationSlide(Presentation presentation, PresentationSlideDto presentationSlideDto, PresentationSlide presentationSlide) {
        presentationSlide.setPresentation(presentation);
        presentationSlide.setTitle(presentationSlideDto.getTitle());
        presentationSlide.setSourceId(presentationSlideDto.getSourceId());
        presentationSlide.setSource(presentationSlideDto.getSource());
        presentationSlide.setInteractionStatus(presentationSlideDto.getInteractionStatus());
        presentationSlide.setDefaultTime(presentationSlideDto.getDefaultTime());
        presentationSlide.setContent(presentationSlideDto.getContent());
        presentationSlide.setStatus("PUBLISHED");
        presentationSlide.setSlideOrder(presentationSlideDto.getSlideOrder());
        return presentationSlide;
    }


    public ResponseEntity<String> editPresentation(EditPresentationDto editPresentationDto) {
        Optional<Presentation> presentation = presentationRepository.findById(editPresentationDto.getId());

        if (presentation.isEmpty())
            throw new VacademyException("Presentation not found");

        presentation.get().setTitle(editPresentationDto.getTitle());
        presentation.get().setDescription(editPresentationDto.getDescription());
        presentation.get().setCoverFileId(editPresentationDto.getCoverFileId());
        presentationRepository.save(presentation.get());

        List<PresentationSlideDto> questionSlides = new ArrayList<>();
        List<PresentationSlideDto> excalidrawSlides = new ArrayList<>();
        for (PresentationSlideDto presentationSlideDto : editPresentationDto.getAddedSlides()) {
            if (presentationSlideDto.getSource().equalsIgnoreCase("excalidraw")) {
                excalidrawSlides.add(presentationSlideDto);
            } else if (presentationSlideDto.getSource().equalsIgnoreCase("question")) {
                questionSlides.add(presentationSlideDto);
            }
        }

        addEditQuestionSlides(presentation.get(), questionSlides);
        addEditExcalidrawSlides(presentation.get(), excalidrawSlides);
        return ResponseEntity.ok("Presentation updated successfully");

    }

    public ResponseEntity<AddPresentationDto> getPresentation(String presentationId) {
        Optional<Presentation> presentation = presentationRepository.findById(presentationId);
        if (presentation.isEmpty())
            throw new VacademyException("Presentation not found");

        AddPresentationDto presentationDto = new AddPresentationDto();
        presentationDto.setId(presentation.get().getId());
        presentationDto.setTitle(presentation.get().getTitle());
        presentationDto.setDescription(presentation.get().getDescription());
        presentationDto.setCoverFileId(presentation.get().getCoverFileId());
        presentationDto.setAddedSlides(getPresentationSlides(presentation.get()));
        return ResponseEntity.ok(presentationDto);
    }

    List<PresentationSlideDto> getPresentationSlides(Presentation presentation) {
        List<PresentationSlide> presentationSlides = presentationSlideRepository.findAllByPresentationAndStatusIn(presentation, List.of("PUBLISHED"));
        List<PresentationSlideDto> presentationSlideDtos = new ArrayList<>();
        for (PresentationSlide presentationSlide : presentationSlides) {
            PresentationSlideDto presentationSlideDto = new PresentationSlideDto();
            presentationSlideDto.setId(presentationSlide.getId());
            presentationSlideDto.setTitle(presentationSlide.getTitle());
            presentationSlideDto.setSourceId(presentationSlide.getSourceId());
            presentationSlideDto.setSource(presentationSlide.getSource());
            presentationSlideDto.setInteractionStatus(presentationSlide.getInteractionStatus());
            presentationSlideDto.setDefaultTime(presentationSlide.getDefaultTime());
            presentationSlideDto.setContent(presentationSlide.getContent());
            presentationSlideDto.setSlideOrder(presentationSlide.getSlideOrder());
            if (presentationSlideDto.getSource().equalsIgnoreCase("question")) {
                Question question = questionRepository.findById(presentationSlideDto.getSourceId()).get();
                presentationSlideDto.setAddedQuestion(new QuestionDTO(question, true));
            }
            presentationSlideDtos.add(presentationSlideDto);

        }
        return presentationSlideDtos;
    }

    public ResponseEntity<List<AddPresentationDto>> getAllPresentation(String instituteId) {

        if (instituteId == null)
            throw new VacademyException("Institute id not found");
        return ResponseEntity.ok(presentationRepository.findAllByInstituteIdAndStatusIn(instituteId, List.of("PUBLISHED")).stream().map(AddPresentationDto::new).toList());
    }
}
