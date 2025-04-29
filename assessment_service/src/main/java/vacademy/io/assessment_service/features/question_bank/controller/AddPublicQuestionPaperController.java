package vacademy.io.assessment_service.features.question_bank.controller;


import com.fasterxml.jackson.core.JsonProcessingException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.question_bank.dto.AddQuestionDTO;
import vacademy.io.assessment_service.features.question_bank.dto.AddQuestionPaperDTO;
import vacademy.io.assessment_service.features.question_bank.dto.AddedQuestionPaperResponseDto;
import vacademy.io.assessment_service.features.question_bank.manager.AddQuestionPaperFromImportManager;
import vacademy.io.assessment_service.features.question_bank.manager.EditQuestionPaperManager;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

@RestController
@RequestMapping("/assessment-service/question-paper/public/manage/v1")
public class AddPublicQuestionPaperController {

    @Autowired
    AddQuestionPaperFromImportManager addQuestionPaperFromImportManager;

    @Autowired
    EditQuestionPaperManager editQuestionPaperManager;

    @PostMapping("/add")
    public ResponseEntity<AddedQuestionPaperResponseDto> addQuestionPaper(@RequestAttribute("user") CustomUserDetails user, @RequestBody AddQuestionPaperDTO questionRequestBody) {
        try {
            return ResponseEntity.ok(addQuestionPaperFromImportManager.addQuestionPaper(user, questionRequestBody, true));
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }


    @PostMapping("/update")
    public ResponseEntity<Boolean> updateQuestionPaper(@RequestAttribute("user") CustomUserDetails user, @RequestBody AddQuestionPaperDTO questionRequestBody) {
        try {
            return ResponseEntity.ok(addQuestionPaperFromImportManager.updateQuestionPaper(user, questionRequestBody, true));
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PostMapping("/add-only-question")
    public ResponseEntity<AddQuestionDTO> addPrivateQuestion(@RequestAttribute("user") CustomUserDetails user, @RequestBody AddQuestionDTO questionRequestBody) {
        try {
            return ResponseEntity.ok(addQuestionPaperFromImportManager.addPrivateQuestions(user, questionRequestBody, false));
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PostMapping("delete")
    public ResponseEntity<Boolean> deletePublicQuestionPaper(@RequestAttribute("user") CustomUserDetails user,
                                                             @RequestParam String questionPaperId) {
        try {
            return ResponseEntity.ok(editQuestionPaperManager.deletePublicQuestionPaperById(user, questionPaperId));
        } catch (VacademyException e) {
            throw new VacademyException(e.getMessage());
        } catch (RuntimeException e) {
            throw new VacademyException("An unexpected error occurred.");
        }
    }


    @PostMapping("public/add-only-question")
    public ResponseEntity<AddQuestionDTO> addPublicQuestion(@RequestAttribute("user") CustomUserDetails user, @RequestBody AddQuestionDTO questionRequestBody) {
        try {
            return ResponseEntity.ok(addQuestionPaperFromImportManager.addPrivateQuestions(user, questionRequestBody, true));
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }

}
