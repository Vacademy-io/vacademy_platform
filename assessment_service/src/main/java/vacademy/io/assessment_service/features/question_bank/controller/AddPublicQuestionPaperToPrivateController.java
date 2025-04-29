package vacademy.io.assessment_service.features.question_bank.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.question_bank.dto.AddedQuestionPaperResponseDto;
import vacademy.io.assessment_service.features.question_bank.manager.AddPublicQuestionPaperToPrivate;
import vacademy.io.assessment_service.features.question_bank.manager.EditQuestionPaperManager;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;


@RestController
@RequestMapping("/assessment-service/question-paper/manage/v1")
public class AddPublicQuestionPaperToPrivateController {

    @Autowired
    AddPublicQuestionPaperToPrivate addPublicQuestionPaperToPrivate;

    @Autowired
    EditQuestionPaperManager editQuestionPaperManager;

    @PostMapping("/add-public-to-private")
    public ResponseEntity<AddedQuestionPaperResponseDto> addQuestionPaper(@RequestAttribute("user") CustomUserDetails user, @RequestParam String instituteId, @RequestParam String questionPaperId) {
        try {
            return ResponseEntity.ok(addPublicQuestionPaperToPrivate.addPublicQuestionPaperToPrivateInstitute(user, instituteId, questionPaperId));
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }

}
