package vacademy.io.common.ai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Data
public class RichTextDataDTO {

    private String id;
    private String type;
    private String content;

    // Default constructor
    public RichTextDataDTO() {
    }

    // Parameterized constructor
    public RichTextDataDTO(String id, String type, String content) {
        this.id = id;
        this.type = type;
        this.content = content;
    }

}
