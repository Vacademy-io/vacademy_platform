package vacademy.io.common.notification.dto;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.Data;

@Data
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
    @JsonSubTypes.Type(value = MediaContent.class, name = "VIEW_MEDIA_LINKS")
    // Add more subtypes here as needed
})
public abstract class AlertData {
    // Common fields can be added here if necessary

    public abstract String getHtmlText(String name, String title, String description);
}