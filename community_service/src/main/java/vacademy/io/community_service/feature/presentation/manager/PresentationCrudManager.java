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

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

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
        return Presentation.builder().title(addPresentationDto.getTitle()).coverFileId(addPresentationDto.getCoverFileId()).description(addPresentationDto.getDescription()).instituteId(instituteId).status("PUBLISHED").build();
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


    public ResponseEntity<List<PresentationSlideDto>> editPresentation(EditPresentationDto editPresentationDto) {
        Optional<Presentation> presentation = presentationRepository.findById(editPresentationDto.getId());

        if (presentation.isEmpty())
            throw new VacademyException("Presentation not found");

        if (editPresentationDto.getTitle() != null) {
            presentation.get().setTitle(editPresentationDto.getTitle());
        }
        if (editPresentationDto.getDescription() != null) {
            presentation.get().setDescription(editPresentationDto.getDescription());
        }
        if (editPresentationDto.getCoverFileId() != null) {
            presentation.get().setCoverFileId(editPresentationDto.getCoverFileId());
        }
        if (editPresentationDto.getStatus() != null) {
            presentation.get().setStatus(editPresentationDto.getStatus());
        }
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


        for (PresentationSlideDto presentationSlideDto : editPresentationDto.getUpdatedSlides()) {
            if (presentationSlideDto.getSource().equalsIgnoreCase("excalidraw")) {
                excalidrawSlides.add(presentationSlideDto);
            } else if (presentationSlideDto.getSource().equalsIgnoreCase("question")) {
                questionSlides.add(presentationSlideDto);
            }
        }


        addEditQuestionSlides(presentation.get(), questionSlides);
        addEditExcalidrawSlides(presentation.get(), excalidrawSlides);

        List<PresentationSlide> deletedSlides = new ArrayList<>();
        for (PresentationSlideDto presentationSlideDto : editPresentationDto.getDeletedSlides()) {
            Optional<PresentationSlide> presentationSlide = presentationSlideRepository.findById(presentationSlideDto.getId());
            if(presentationSlide.isEmpty()) continue;
            presentationSlide.get().setStatus("DELETED");
            deletedSlides.add(presentationSlide.get());
        }

        presentationSlideRepository.saveAll(deletedSlides);

        return ResponseEntity.ok(getPresentationSlides(presentation.get()));

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
        List<PresentationSlide> presentationSlides = presentationSlideRepository.findAllByPresentationAndStatusNotOrderBySlideOrderAsc(presentation, "DELETED");
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

    // In class PresentationCrudManager

    public ResponseEntity<PresentationSlideDto> addSlideAfterIndex(String presentationId, Integer afterSlideOrder, PresentationSlideDto newSlideDto) {
        // 1. Find the presentation
        Optional<Presentation> presentationOptional = presentationRepository.findById(presentationId);
        if (presentationOptional.isEmpty()) {
            throw new VacademyException("Presentation not found with id: " + presentationId);
        }
        Presentation presentation = presentationOptional.get();

        // 2. Fetch all non-deleted slides, sorted by their current order
        List<PresentationSlide> slides = presentationSlideRepository.findAllByPresentationAndStatusNotOrderBySlideOrderAsc(presentation, "DELETED");

        // 3. Make space for the new slide by incrementing the order of subsequent slides
        List<PresentationSlide> slidesToUpdate = new ArrayList<>();
        for (PresentationSlide slide : slides) {
            if (slide.getSlideOrder() != null && slide.getSlideOrder() > afterSlideOrder) {
                slide.setSlideOrder(slide.getSlideOrder() + 1);
                slidesToUpdate.add(slide);
            }
        }
        presentationSlideRepository.saveAll(slidesToUpdate);

        // 4. Set the order for the new slide
        newSlideDto.setSlideOrder(afterSlideOrder + 1);

        // 5. Create and save the new slide using existing logic
        List<PresentationSlide> newSlides;
        if (newSlideDto.getSource().equalsIgnoreCase("excalidraw")) {
            newSlides = addEditExcalidrawSlides(presentation, List.of(newSlideDto));
        } else if (newSlideDto.getSource().equalsIgnoreCase("question")) {
            newSlides = addEditQuestionSlides(presentation, List.of(newSlideDto));
        } else {
            throw new VacademyException("Unknown slide source: " + newSlideDto.getSource());
        }

        if (newSlides == null || newSlides.isEmpty()) {
            throw new VacademyException("Failed to create the new slide.");
        }

        // 6. Create a DTO from the newly saved slide entity and return it
        PresentationSlide newSlideEntity = newSlides.get(0);
        PresentationSlideDto resultDto = new PresentationSlideDto();
        resultDto.setId(newSlideEntity.getId());
        resultDto.setPresentationId(newSlideEntity.getPresentation().getId());
        resultDto.setTitle(newSlideEntity.getTitle());
        resultDto.setSourceId(newSlideEntity.getSourceId());
        resultDto.setSource(newSlideEntity.getSource());
        resultDto.setSlideOrder(newSlideEntity.getSlideOrder());
        resultDto.setContent(newSlideEntity.getContent());
        resultDto.setStatus(newSlideEntity.getStatus());
        resultDto.setDefaultTime(newSlideEntity.getDefaultTime());

        return ResponseEntity.ok(resultDto);
    }
}
