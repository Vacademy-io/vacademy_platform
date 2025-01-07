package vacademy.io.assessment_service.features.question_bank.manager;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.evaluation.service.QuestionEvaluationService;
import vacademy.io.assessment_service.features.question_bank.dto.AllQuestionPaperResponse;
import vacademy.io.assessment_service.features.question_bank.dto.QuestionPaperDTO;
import vacademy.io.assessment_service.features.question_bank.dto.QuestionPaperFilter;
import vacademy.io.assessment_service.features.question_bank.entity.QuestionPaper;
import vacademy.io.assessment_service.features.question_bank.repository.QuestionPaperRepository;
import vacademy.io.assessment_service.features.question_core.repository.QuestionRepository;
import vacademy.io.assessment_service.features.rich_text.repository.AssessmentRichTextRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.*;

import static vacademy.io.common.core.standard_classes.ListService.createSortObject;

@Component
public class GetQuestionPaperManager {


    @Autowired
    QuestionPaperRepository questionPaperRepository;

    public AllQuestionPaperResponse getQuestionPapers(CustomUserDetails user, QuestionPaperFilter questionPaperFilter, String instituteId, int pageNo, int pageSize) {
        // Create a sorting object based on the provided sort columns
        Sort thisSort = createSortObject(questionPaperFilter.getSortColumns());

        //TODO: Check user permission

        // Create a pageable instance for pagination
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        makeFilterFieldEmptyArrayIfNull(questionPaperFilter);

        // Retrieve employees based on the filter criteria
        Page<Object[]> employeePage = questionPaperRepository.findQuestionPapersByFilters(questionPaperFilter.getName(), questionPaperFilter.getStatuses(), questionPaperFilter.getLevelIds(), questionPaperFilter.getSubjectIds(), null, List.of(instituteId), pageable);

        return createAllQuestionPaperResponseFromPaginatedData(employeePage);

    }

    private void makeFilterFieldEmptyArrayIfNull(QuestionPaperFilter questionPaperFilter) {

        if (questionPaperFilter.getLevelIds() == null) {
            questionPaperFilter.setLevelIds(new ArrayList<>());
        }
        if (questionPaperFilter.getSubjectIds() == null) {
            questionPaperFilter.setSubjectIds(new ArrayList<>());
        }
        if (questionPaperFilter.getStatuses() == null) {
            questionPaperFilter.setStatuses(new ArrayList<>());
        }
    }

    private AllQuestionPaperResponse createAllQuestionPaperResponseFromPaginatedData(Page<Object[]> questionPapers) {
        List<QuestionPaperDTO> content = new ArrayList<>();
        if (!Objects.isNull(questionPapers)) {
            content = questionPapers.getContent().stream().map(object -> new QuestionPaperDTO(
                    (String) object[0], // id
                    (String) object[1], // title
                    (String) object[2], // status
                    (String) object[3], // levelId
                    (String) object[4], // subjectId
                    (Date) object[5], // createdOn
                    (Date) object[6], // updatedOn
                    (String) object[7]  // createdByUserId
            )).toList();
            return AllQuestionPaperResponse.builder().content(content).pageNo(questionPapers.getNumber()).last(questionPapers.isLast()).pageSize(questionPapers.getSize()).totalPages(questionPapers.getTotalPages()).totalElements(questionPapers.getTotalElements()).build();
        }
        return AllQuestionPaperResponse.builder().totalPages(0).content(content).pageNo(0).totalPages(0).build();
    }
}
