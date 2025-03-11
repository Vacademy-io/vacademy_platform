package vacademy.io.admin_core_service.features.institute.constants;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class ConstantsSubModuleList {
    private static final Map<String, List<String>> SUB_MODULES_IDS = new HashMap<>();

    // Static block to initialize the MAP
    static {
        List<String> moduleOneSubModule = List.of("1");
        List<String> moduleTwoSubModule = List.of("2");

        SUB_MODULES_IDS.put("1", moduleOneSubModule);
        SUB_MODULES_IDS.put("3", moduleOneSubModule);
        SUB_MODULES_IDS.put("5", moduleOneSubModule);
        SUB_MODULES_IDS.put("6", moduleOneSubModule);
        SUB_MODULES_IDS.put("7", moduleOneSubModule);
        SUB_MODULES_IDS.put("8", moduleOneSubModule);
        SUB_MODULES_IDS.put("9", moduleOneSubModule);
        SUB_MODULES_IDS.put("10", moduleOneSubModule);
        SUB_MODULES_IDS.put("11", moduleOneSubModule);

        SUB_MODULES_IDS.put("2", moduleTwoSubModule);
        SUB_MODULES_IDS.put("4", moduleTwoSubModule);
        SUB_MODULES_IDS.put("12", moduleTwoSubModule);
        SUB_MODULES_IDS.put("13", moduleTwoSubModule);
        SUB_MODULES_IDS.put("15", moduleTwoSubModule);
        SUB_MODULES_IDS.put("16", moduleTwoSubModule);
        SUB_MODULES_IDS.put("17", moduleTwoSubModule);
        SUB_MODULES_IDS.put("18", moduleTwoSubModule);
        SUB_MODULES_IDS.put("19", moduleTwoSubModule);
    }

    public static List<String> getSubModulesForModule(String moduleId) {
        return SUB_MODULES_IDS.get(moduleId);
    }
}
