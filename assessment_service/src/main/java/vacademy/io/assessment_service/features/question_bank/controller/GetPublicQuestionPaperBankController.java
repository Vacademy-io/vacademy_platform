package vacademy.io.assessment_service.features.question_bank.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.question_bank.dto.AllQuestionPaperResponse;
import vacademy.io.assessment_service.features.question_bank.dto.QuestionPaperFilter;
import vacademy.io.assessment_service.features.question_bank.manager.GetPublicQuestionPaperManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/assessment-service/question-paper/public/view/v1")

public class GetPublicQuestionPaperBankController {

    @Autowired
    GetPublicQuestionPaperManager getQuestionPaperManager;

    @PostMapping("/get-with-filters")
    public ResponseEntity<AllQuestionPaperResponse> getQuestionPapers(@RequestAttribute("user") CustomUserDetails user, @RequestBody QuestionPaperFilter questionPaperFilter,
                                                                      @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                                      @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize) {
        return ResponseEntity.ok(getQuestionPaperManager.getQuestionPapers(user, questionPaperFilter, pageNo, pageSize));
    }
}
