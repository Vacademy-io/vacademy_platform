package vacademy.io.media_service.service.pdf_covert;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;


@Builder
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ConversationDto {
    private String user;
    private String aiResponse;
    private Date createdAt;
}
