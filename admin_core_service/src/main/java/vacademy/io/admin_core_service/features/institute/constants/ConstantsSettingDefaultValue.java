package vacademy.io.admin_core_service.features.institute.constants;

import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ConstantsSettingDefaultValue {

    private static final Map<String, String> nameDefaultValues = new HashMap<>();

    static {
        nameDefaultValues.put("Course", "Course");
        nameDefaultValues.put("Level", "Level");
        nameDefaultValues.put("Session", "Session");
        nameDefaultValues.put("Subjects", "Subjects");
        nameDefaultValues.put("Modules", "Modules");
        nameDefaultValues.put("Chapters", "Chapters");
        nameDefaultValues.put("Slides", "Slides");
        nameDefaultValues.put("Admin", "Admin");
        nameDefaultValues.put("Teacher", "Teacher");
        nameDefaultValues.put("CourseCreator", "Course Creator");
        nameDefaultValues.put("AssessmentCreator", "Assessment Creator");
        nameDefaultValues.put("Evaluator", "Evaluator");
        nameDefaultValues.put("Student", "Student");
        nameDefaultValues.put("LiveSession", "Live Session");
    }

    public static NameSettingRequest getDefaultNamingSettingRequest() {
        NameSettingRequest request = new NameSettingRequest();

        Map<String, String> nameMap = new HashMap<>();
        List<String> keys = List.of(
                "Course", "Level", "Session",
                "Subjects", "Modules", "Chapters", "Slides",
                "Admin", "Teacher", "CourseCreator", "AssessmentCreator",
                "Evaluator", "Student", "LiveSession"
        );

        for (String key : keys) {
            nameMap.put(key, nameDefaultValues.get(key));
        }

        request.setNameRequest(nameMap);
        return request;
    }

    public static String getNameSystemValueForKey(String key) {
        return nameDefaultValues.get(key);
    }

}
