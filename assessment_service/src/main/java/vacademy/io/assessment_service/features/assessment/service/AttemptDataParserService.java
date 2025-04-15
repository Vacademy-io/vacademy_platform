package vacademy.io.assessment_service.features.assessment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;

@Service
public class AttemptDataParserService {


    public String getClientLastSyncTime(String jsonString) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(jsonString);

            JsonNode clientLastSyncNode = root.path("clientLastSync");
            return clientLastSyncNode.asText();
        } catch (Exception e) {
            return null;
        }
    }

    public Long getTimeElapsedInSecondsFromAttemptData(String jsonString) {
        try {
            if (jsonString == null || jsonString.isEmpty()) {
                return null;
            }

            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(jsonString);

            JsonNode timeNode = root.path("assessment").path("timeElapsedInSeconds");

            if (!timeNode.isMissingNode() && !timeNode.isNull()) {
                return timeNode.asLong();
            } else {
                return null;
            }

        } catch (Exception e) {
            return null;
        }
    }

    public List<String> extractSectionJsonStrings(String jsonString) {
        List<String> sectionJsonList = new ArrayList<>();

        try {
            if (jsonString == null || jsonString.isEmpty()) {
                return sectionJsonList;
            }

            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(jsonString);

            JsonNode sectionsNode = root.path("sections");

            if (sectionsNode.isArray()) {
                for (JsonNode sectionNode : sectionsNode) {
                    String sectionJson = mapper.writeValueAsString(sectionNode);
                    sectionJsonList.add(sectionJson);
                }
            }

        } catch (Exception e) {
            throw new VacademyException("Failed To read Json: "+e.getMessage());
        }

        return sectionJsonList;
    }

    public List<String> extractQuestionJsonsFromSection(String sectionJson) {
        List<String> questionJsons = new ArrayList<>();
        ObjectMapper mapper = new ObjectMapper();

        try {
            if (sectionJson == null || sectionJson.isEmpty()) return questionJsons;

            JsonNode sectionNode = mapper.readTree(sectionJson);
            JsonNode questionsNode = sectionNode.path("questions");

            if (questionsNode.isArray()) {
                for (JsonNode questionNode : questionsNode) {
                    questionJsons.add(mapper.writeValueAsString(questionNode));
                }
            }

        } catch (Exception e) {
            throw new VacademyException("Failed To read Json: "+e.getMessage());
        }

        return questionJsons;
    }

    public String extractSectionIdFromSectionJson(String sectionJson) {
        ObjectMapper mapper = new ObjectMapper();

        try {
            if (sectionJson == null || sectionJson.isEmpty()) return null;

            JsonNode sectionNode = mapper.readTree(sectionJson);
            JsonNode sectionIdNode = sectionNode.path("sectionId");

            if (!sectionIdNode.isMissingNode() && !sectionIdNode.isNull()) {
                return sectionIdNode.asText();
            }

        } catch (Exception e) {
            throw new VacademyException("Failed To read Json: "+e.getMessage());
        }

        return null; // return null if not found or error
    }

    public String extractQuestionIdFromQuestionJson(String questionJson) {
        ObjectMapper mapper = new ObjectMapper();

        try {
            if (questionJson == null || questionJson.isEmpty()) return null;

            JsonNode sectionNode = mapper.readTree(questionJson);
            JsonNode questionIdNode = sectionNode.path("questionId");

            if (!questionIdNode.isMissingNode() && !questionIdNode.isNull()) {
                return questionIdNode.asText();
            }

        } catch (Exception e) {
            throw new VacademyException("Failed To read Json: "+e.getMessage());
        }

        return null; // return null if not found or error
    }

    public String extractResponseTypeFromQuestionJson(String questionJson) {
        ObjectMapper mapper = new ObjectMapper();

        try {
            if (questionJson == null || questionJson.isEmpty()) return null;

            JsonNode questionNode = mapper.readTree(questionJson);
            JsonNode responseNode = questionNode.path("responseData");
            JsonNode typeNode = responseNode.path("type");

            if (!typeNode.isMissingNode() && !typeNode.isNull()) {
                return typeNode.asText();
            }

        } catch (Exception e) {
            throw new VacademyException("Failed To read Json: "+e.getMessage());
        }

        return null;
    }

    public Long extractTimeTakenInSecondsFromQuestionJson(String questionJson) {
        ObjectMapper mapper = new ObjectMapper();

        try {
            if (questionJson == null || questionJson.isEmpty()) return null;

            JsonNode questionNode = mapper.readTree(questionJson);
            JsonNode timeTakenNode = questionNode.path("timeTakenInSeconds");

            if (!timeTakenNode.isMissingNode() && !timeTakenNode.isNull()) {
                return timeTakenNode.asLong();
            }

        } catch (Exception e) {
            throw new VacademyException("Failed To read Json: "+e.getMessage());
        }

        return null; // return null if not found or error
    }

    public long getSectionDurationLeftInSeconds(String sectionJson) {
        return 0L;
    }

    public Long getQuestionDurationLeftInSecondsFromQuestionJson(String questionJson) {
        return 0L;
    }
}
