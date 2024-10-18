package labor.link.media_service.entity;


import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
public class Template {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    private String fileId;

    private String tag;
}