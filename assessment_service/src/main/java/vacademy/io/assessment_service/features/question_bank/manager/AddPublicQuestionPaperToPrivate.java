package vacademy.io.assessment_service.features.question_bank.manager;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.question_bank.dto.AddedQuestionPaperResponseDto;
import vacademy.io.assessment_service.features.question_bank.entity.QuestionPaper;
import vacademy.io.assessment_service.features.question_bank.repository.QuestionPaperRepository;
import vacademy.io.assessment_service.features.question_bank.service.QuestionPaperService;
import vacademy.io.assessment_service.features.question_core.dto.QuestionDTO;
import vacademy.io.assessment_service.features.question_core.enums.QuestionAccessLevel;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Component
public class AddPublicQuestionPaperToPrivate {

    @Autowired
    QuestionPaperService questionPaperService;

    @Autowired
    QuestionPaperRepository questionPaperRepository;

    @Autowired
    AddQuestionPaperFromImportManager addQuestionPaperFromImportManager;

    @Transactional
    public AddedQuestionPaperResponseDto addPublicQuestionPaperToPrivateInstitute(CustomUserDetails user, String instituteId, String questionPaperId) throws JsonProcessingException {

        QuestionPaper questionPaper = new QuestionPaper();

        Optional<QuestionPaper> publicPaperById = questionPaperRepository.findById(questionPaperId);
        if (publicPaperById.isEmpty()) throw new VacademyException("Question paper for this Id does not exists");

        QuestionPaper publicPaper = publicPaperById.get();

        // set the details of public paper to the new paper
        questionPaper.setTitle(publicPaper.getTitle());
        questionPaper.setCreatedByUserId(user.getUserId());
        questionPaper.setDescription(publicPaper.getDescription());
        questionPaper.setAccess(QuestionAccessLevel.PRIVATE.name());


        List<QuestionDTO> questionsOfPublicPaper = questionPaperService.getQuestionsByQuestionPaper(questionPaperId);

        questionPaper = questionPaperRepository.save(questionPaper);

        List<String> savedQuestionIds = new ArrayList<>();
        for (int i = 0; i < questionsOfPublicPaper.size(); i++) {
            savedQuestionIds.add(questionsOfPublicPaper.get(i).getId());
        }

        // add the public question to the new created paper
        questionPaperRepository.bulkInsertQuestionsToQuestionPaper(questionPaper.getId(), savedQuestionIds);

        // map new question to the institute
        // level id and subject id is null as the public question does not have that
        questionPaperRepository.linkInstituteToQuestionPaper(UUID.randomUUID().toString(), questionPaper.getId(), instituteId, "ACTIVE", null, null);


        return new AddedQuestionPaperResponseDto(questionPaper.getId());

    }

}



