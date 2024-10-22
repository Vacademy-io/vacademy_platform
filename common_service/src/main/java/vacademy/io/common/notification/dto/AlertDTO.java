package vacademy.io.common.notification.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AlertDTO {
    private String id;
    private String category;
    private String source;
    private String sourceId;
    private String description;
    private String title;
    private String isActive;
    private String data;
    private String siteId;
    private String type;
    private Date eventAt;
    private List<AlertRecipientCreationDTO> recipients; // New field for recipients


}