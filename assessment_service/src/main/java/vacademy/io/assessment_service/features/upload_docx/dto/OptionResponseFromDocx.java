package vacademy.io.assessment_service.features.upload_docx.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class OptionResponseFromDocx {
    private int optionId;
    private String optionHtml;

}
