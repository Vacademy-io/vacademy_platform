package vacademy.io.media_service.controller.ll_ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.ai.ExternalAIApiServiceImpl;
import vacademy.io.media_service.constant.IncidentType;
import vacademy.io.media_service.constant.LL_AI_Constant;
import vacademy.io.media_service.controller.question_metadata_extractor.dto.QuestionMetadataExtractorResponse;
import vacademy.io.media_service.dto.DeepSeekResponse;
import vacademy.io.media_service.dto.ll_ai.IncidentAIStructureResponse;
import vacademy.io.media_service.util.JsonUtils;

import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/media-service/ai/ll")
public class LlController {

    @Autowired
    ExternalAIApiServiceImpl deepSeekApiService;

    @PostMapping("/generate-incident-structure")
    public ResponseEntity<IncidentAIStructureResponse> generateIncidentStructure(
            @RequestBody Map<String, String> request) throws JsonProcessingException {
        Map<String, IncidentType> incidentTypes = LL_AI_Constant.getIncidentTypes();
        ObjectMapper mapper = new ObjectMapper();
        String incidentsAndTypes = mapper.writeValueAsString(incidentTypes);

        Map<String, Object> promptMap = Map.of("incidentTypes", incidentsAndTypes, "incidentText", request.get("data"));

        String template = """
                Generate incident details for the following raw incident data:
                {incidentText}


                Incident Category, Code Mapping : {incidentTypes}
                We need to extract a title, description, and categorize a incident code, category and subcategory

                also if the raw incident data if not in english then translate it to english
                return the data in a json structure
                {{
                    "event_code": "INCIDENT_CODE", // from Incident Category, Code Mapping like ET1002
                    "category": "INCIDENT_CATEGORY", // for the same event code
                    "subcategory": "INCIDENT_SUBCATEGORY", // from Incident Category, Code Mapping
                    "description": "INCIDENT_DESCRIPTION", // make a detailed report for the incident
                    "title": "INCIDENT_TITLE", // title of the incident
                    "was_reported_to_police": true/false, // check if the incident was reported to police
                    "people_injured": [ // list of people injured if any
                        {{
                            "name": "NAME",
                            "nature": "NATURE_OF_INJURY",
                            "is_employee": true/false // check if the person is an employee
                        }}
                    ],
                    "property_loss": [ // list of property damages or stolen items if any
                        {{
                            "name": "PROPERTY_NAME", // Name of the property damaged or stolen
                            "description": "DESCRIPTION", // Description of the damage or theft
                            "loss_value": 0.0, // Estimated loss value
                            "type": "DAMAGE/STOLEN" // type of loss: either "DAMAGE" or "STOLEN"
                        }}
                    ],
                    "suspects": [ // list of suspects if any
                        {{
                            "name": "NAME", // Name of the suspect keep empty if not known
                            "description": "DESCRIPTION" // Description of the suspect
                        }}
                    ]
                }}
                """;
        Prompt prompt = new PromptTemplate(template).create(promptMap);

        DeepSeekResponse response = deepSeekApiService.getChatCompletion("google/gemini-2.5-flash",
                prompt.getContents().trim(), 30000);

        if (Objects.isNull(response) || Objects.isNull(response.getChoices()) || response.getChoices().isEmpty()) {
            throw new VacademyException("Failed to get response from deepseek");
        }

        String validJson = JsonUtils.extractAndSanitizeJson(response.getChoices().get(0).getMessage().getContent());
        IncidentAIStructureResponse objectResponse = mapper.readValue(validJson,
                new TypeReference<IncidentAIStructureResponse>() {
                });
        return ResponseEntity.ok(objectResponse);

    }
}
