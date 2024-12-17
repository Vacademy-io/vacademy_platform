package vacademy.io.assessment_service.features.question_bank.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.question_bank.dto.AllQuestionPaperResponse;
import vacademy.io.assessment_service.features.question_bank.dto.QuestionPaperFilter;
import vacademy.io.assessment_service.features.question_bank.dto.SingleQuestionPaperResponse;
import vacademy.io.assessment_service.features.question_bank.manager.GetQuestionPaperManager;
import vacademy.io.assessment_service.features.question_core.dto.QuestionDTO;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.stream.Collectors;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/assessment-service/question-paper/view/v1")

public class GetQuestionPaperController {

    @Autowired
    QuestionRepository questionRepository;

    @GetMapping("/get-by-id")
    public ResponseEntity<SingleQuestionPaperResponse> getQuestionPaper(@RequestAttribute("user") CustomUserDetails user, @RequestParam("questionPaperId") String questionPaperId) {
            return ResponseEntity.ok(new SingleQuestionPaperResponse(questionRepository.findQuestionsByQuestionPaperId(questionPaperId).stream().map((q) -> new QuestionDTO(q, true)).collect(Collectors.toList())));
    }
}
