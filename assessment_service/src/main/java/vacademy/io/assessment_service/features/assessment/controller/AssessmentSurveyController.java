package vacademy.io.assessment_service.features.assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.SurveyOverviewDetailDto;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.request.IndividualResponseRequestFilter;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.request.RespondentAllResponseFilter;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.response.IndividualAllResponse;
import vacademy.io.assessment_service.features.assessment.dto.survey_dto.response.RespondentAllResponse;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentSurveyManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.auth.config.PageConstants.DEFAULT_PAGE_SIZE;

@RequestMapping("/assessment-service/assessment/survey")
public class AssessmentSurveyController {

    @Autowired
    AssessmentSurveyManager surveyManager;

    @GetMapping("/get-overview")
    public ResponseEntity<SurveyOverviewDetailDto> getSurveyOverview(@RequestAttribute("user")CustomUserDetails userDetails,
                                                                     @RequestParam("instituteId") String instituteId,
                                                                     @RequestParam("sectionIds") String commaSeparatedSectionIds,
                                                                     @RequestParam("assessmentId") String assessmentId){
        return surveyManager.getOverViewDetailsForInstitute(userDetails,instituteId, commaSeparatedSectionIds,assessmentId);
    }

    @PostMapping("/individual-response")
    public ResponseEntity<IndividualAllResponse> getIndividualResponse(@RequestAttribute("user")CustomUserDetails userDetails,
                                                                       @RequestBody IndividualResponseRequestFilter filter,
                                                                       @RequestParam("instituteId") String instituteId,
                                                                       @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                                       @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize){
        return surveyManager.getIndividualPaginatedResponse(userDetails,filter,instituteId, pageNo,pageSize);
    }

    @PostMapping("/respondent-response")
    public ResponseEntity<RespondentAllResponse> getRespondentResponse(@RequestAttribute("user")CustomUserDetails userDetails,
                                                                       @RequestBody RespondentAllResponseFilter filter,
                                                                       @RequestParam("instituteId") String instituteId,
                                                                       @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                                       @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize){
        return surveyManager.getRespondentResponseForEachQuestion(userDetails,filter,instituteId, pageNo,pageSize);
    }


}
