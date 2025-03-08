package vacademy.io.assessment_service.features.question_core.enums;

public enum QuestionTypes {
    MCQS, TF, MATCH, MCQM, FILL_IN_THE_BLANK,
    NUMERIC, // non negative integers
    INTEGER, // negative positive integers
    ONE_DECIMAL, // one number after decimal
    TWO_DECIMAL, // two numbers after decimal
    ANY_DECIMAL // any number of decimal
}
