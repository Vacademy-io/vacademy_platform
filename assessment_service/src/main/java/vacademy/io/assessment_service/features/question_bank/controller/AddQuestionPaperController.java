package vacademy.io.assessment_service.features.question_bank.controller;


import com.fasterxml.jackson.core.JsonProcessingException;
import org.checkerframework.checker.units.qual.A;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.question_bank.dto.AddQuestionPaperDTO;
import vacademy.io.assessment_service.features.question_bank.dto.UpdateQuestionPaperStatus;
import vacademy.io.assessment_service.features.question_bank.manager.AddQuestionPaperFromImportManager;
import vacademy.io.assessment_service.features.question_bank.manager.EditQuestionPaperManager;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

@RestController
@RequestMapping("/assessment-service/question-paper/manage/v1")
public class AddQuestionPaperController {

    @Autowired
    AddQuestionPaperFromImportManager addQuestionPaperFromImportManager;

    @Autowired
    EditQuestionPaperManager editQuestionPaperManager;

    @PostMapping("/add")
    public ResponseEntity<Boolean> addQuestionPaper(@RequestAttribute("user") CustomUserDetails user, @RequestBody AddQuestionPaperDTO questionRequestBody) {
        try {
            return ResponseEntity.ok(addQuestionPaperFromImportManager.addQuestionPaper(user, questionRequestBody));
        } catch (JsonProcessingException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PatchMapping("/edit")
    public ResponseEntity<Boolean> editQuestionPaper(@RequestAttribute("user") CustomUserDetails user, @RequestBody AddQuestionPaperDTO questionRequestBody) {

        return ResponseEntity.ok(addQuestionPaperFromImportManager.editQuestionPaper(user, questionRequestBody));

    }

    @PostMapping("/mark-status")
    public ResponseEntity<Boolean> markStatusOfQuestionPaper(@RequestAttribute("user") CustomUserDetails user, @RequestBody UpdateQuestionPaperStatus updateQuestionPaperStatus) {

        return ResponseEntity.ok(editQuestionPaperManager.markQuestionPaperAsFavourite(user, updateQuestionPaperStatus));
    }


}
