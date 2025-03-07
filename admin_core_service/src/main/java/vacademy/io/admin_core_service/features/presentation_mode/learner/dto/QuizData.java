package vacademy.io.admin_core_service.features.presentation_mode.learner.dto;

import lombok.Data;

import java.util.List;


@Data
public class QuizData {
    private String question;
    private String type;
    private List<String> options;
}