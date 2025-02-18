package vacademy.io.community_service.feature.addFilterToEntity.enums;

public enum entity_name {
    QUESTION,
    QUESTION_PAPER,
    PDF,
    VIDEO,
    PPT;

    // Method to check if a given value is valid
    public static boolean isValid(String value) {
        for (entity_name name : entity_name.values()) {
            if (name.name().equalsIgnoreCase(value)) {
                return true;
            }
        }
        return false;
    }
}
