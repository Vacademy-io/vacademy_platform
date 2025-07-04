package vacademy.io.admin_core_service.features.institute.constants;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ConstantsSubModuleList {
    private static final Map<String, List<String>> MODULE_MAPPING = new HashMap<>();

    // Static block to initialize the MAP
    static {
        List<String> assessModuleSubModule = List.of("1", "3", "5", "6", "7", "8", "9", "10", "11","20", "21", "24", "25", "26", "22", "23", "27", "28", "29");
        List<String> lmsModuleSubModule = List.of("2", "4", "12", "13", "15", "16", "17", "18", "19","30", "31", "32", "33", "34", "35", "36", "37");
        List<String> voltModuleSubModule = List.of("38","39");
        List<String> vsmartModuleSubModule = List.of("41","42","43");

        MODULE_MAPPING.put("1", assessModuleSubModule);
        MODULE_MAPPING.put("2", lmsModuleSubModule);
        MODULE_MAPPING.put("3", voltModuleSubModule);
        MODULE_MAPPING.put("4", vsmartModuleSubModule);
    }

    public static List<String> getSubModulesForModule(String moduleId) {
        return MODULE_MAPPING.get(moduleId);
    }
}
