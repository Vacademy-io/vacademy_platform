package vacademy.io.media_service.dto.chat_with_pdf;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.Date;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@ToString
@Builder
public class ChatWithPdfResponse {
    private String id;
    private Date createdAt;
    private String question;
    private String response;
    private String parentId;
}
