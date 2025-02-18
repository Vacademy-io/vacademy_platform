package vacademy.io.community_service.feature.addFilterToEntity.enums;

public enum EntityName {
    QUESTION,
    QUESTION_PAPER,
    PDF,
    VIDEO,
    PPT;

    // Method to check if a given value is valid
    public static boolean isValid(String value) {
        for (EntityName name : EntityName.values()) {
            if (name.name().equalsIgnoreCase(value)) {
                return true;
            }
        }
        return false;
    }
}
