package vacademy.io.notification_service.features.announcements.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "rich_text_data")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class RichTextData {
    @UuidGenerator
    @Id
    private String id;
    
    private String type; // html, text, video, image, etc.
    
    private String content; // actual content or URL for media
    
    public RichTextData(String type, String content) {
        this.type = type;
        this.content = content;
    }
}