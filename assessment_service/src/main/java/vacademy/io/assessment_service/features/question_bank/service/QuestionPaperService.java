package vacademy.io.assessment_service.features.question_bank.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.question_bank.dto.QuestionPaperDTO;
import vacademy.io.assessment_service.features.question_bank.repository.QuestionPaperRepository;
import vacademy.io.assessment_service.features.question_core.dto.QuestionDTO;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class QuestionPaperService {

    @Autowired
    private QuestionPaperRepository questionPaperRepository;

    @Autowired
    private QuestionRepository questionRepository;

    public Page<QuestionPaperDTO> getPaginatedQuestionPapersByInstituteId(String instituteId, Pageable page) {
        return questionPaperRepository.findByInstituteId(instituteId, page).map(QuestionPaperDTO::new);
        // Convert to DTOs and create a Page object (if necessary)
    }

    public List<QuestionDTO> getQuestionsByQuestionPaper(String questionPaperId) {
        // Assuming you have a QuestionRepository to fetch questions by paper ID.
        return questionRepository.findQuestionsByQuestionPaperId(questionPaperId).stream().map((q) -> new QuestionDTO(q, true)).collect(Collectors.toList());
    }
}
