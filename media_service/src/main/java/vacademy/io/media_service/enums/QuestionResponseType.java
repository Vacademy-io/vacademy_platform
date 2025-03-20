package vacademy.io.media_service.enums;

public enum QuestionResponseType {
    OPTION,
    ONE_WORD,
    LONG_ANSWER,
    SINGLE_DIGIT_NON_NEGATIVE_INTEGER, // 0 - 9 integers
    INTEGER, // positive and negative integers
    POSITIVE_INTEGER, // all positive integers
    DECIMAL; // fractional number with decimal values
}
