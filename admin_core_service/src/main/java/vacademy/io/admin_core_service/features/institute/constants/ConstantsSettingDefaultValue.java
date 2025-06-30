package vacademy.io.admin_core_service.features.institute.constants;

import vacademy.io.admin_core_service.features.institute.dto.settings.naming.NameSettingRequest;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ConstantsSettingDefaultValue {

    public static NameSettingRequest getDefaultNamingSettingRequest() {
        NameSettingRequest request = new NameSettingRequest();

        Map<String, String> nameMap = new HashMap<>();
        List<String> keys = List.of(
                "Course", "Level", "Session",
                "Subjects", "Modules", "Chapters", "Slides",
                "Admin", "Teacher", "Course creator", "Assessment Creator",
                "Evaluator", "Student", "Live Session"
        );

        for (String key : keys) {
            nameMap.put(key, key);
        }

        request.setNameRequest(nameMap);
        return request;
    }

}
