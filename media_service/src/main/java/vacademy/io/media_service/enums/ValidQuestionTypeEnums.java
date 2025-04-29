package vacademy.io.media_service.enums;

public enum ValidQuestionTypeEnums {
    MCQS,MCQM,ONE_WORD,LONG_ANSWER;


    public static boolean isValid(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        for (ValidQuestionTypeEnums type : ValidQuestionTypeEnums.values()) {
            if (type.name().equalsIgnoreCase(value)) {
                return true;
            }
        }
        return false;
    }


}
