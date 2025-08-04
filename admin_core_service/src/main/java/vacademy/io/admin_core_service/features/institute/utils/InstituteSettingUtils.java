package vacademy.io.admin_core_service.features.institute.utils;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute.dto.settings.InstituteSettingDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.SettingDto;

import java.util.Map;

public class InstituteSettingUtils {

    public static Boolean isAllowLearnersToCreateCoursesEnabled(String json) {
        if (!StringUtils.hasText(json)) {
            return false;
        }

        try {
            ObjectMapper mapper = new ObjectMapper();
            InstituteSettingDto instituteSettingDto = mapper.readValue(json, InstituteSettingDto.class);

            if (instituteSettingDto.getSetting() == null) {
                return false;
            }

            SettingDto courseSetting = instituteSettingDto.getSetting().get("COURSE_SETTING");
            if (courseSetting == null || courseSetting.getData() == null) {
                return false;
            }

            JsonNode dataNode = mapper.convertValue(courseSetting.getData(), JsonNode.class);
            JsonNode permissionsNode = dataNode.get("permissions");

            if (permissionsNode != null && permissionsNode.has("allowLearnersToCreateCourses")) {
                return permissionsNode.get("allowLearnersToCreateCourses").asBoolean();
            }

        } catch (Exception e) {
            e.printStackTrace();
        }

        return false;
    }
}
