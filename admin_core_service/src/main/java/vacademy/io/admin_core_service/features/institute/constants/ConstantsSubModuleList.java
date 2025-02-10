package vacademy.io.admin_core_service.features.institute.constants;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ConstantsSubModuleList {
    private static final Map<String,List<String>> SUB_MODULES_IDS = new HashMap<>();

    // Static block to initialize the MAP
    static {
        List<String> moduleOneSubModule = List.of("1");
        List<String> moduleTwoSubModule = List.of("2");

        SUB_MODULES_IDS.put("1", moduleOneSubModule);
        SUB_MODULES_IDS.put("2", moduleTwoSubModule);
    }

    public static List<String> getSubModulesForModule(String moduleId) {
        return SUB_MODULES_IDS.get(moduleId);
    }
}
