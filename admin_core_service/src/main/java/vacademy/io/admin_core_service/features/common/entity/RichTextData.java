package vacademy.io.admin_core_service.features.common.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.ai.dto.RichTextDataDTO;

@Entity
@AllArgsConstructor
@Getter
@Setter
public class RichTextData {
    @UuidGenerator
    @Id
    private String id;
    private String type;
    private String content;

    public RichTextData() {
    }

    public RichTextData(RichTextDataDTO richTextDataDTO) {
        if (richTextDataDTO == null) return;
        this.type = richTextDataDTO.getType();
        this.content = richTextDataDTO.getContent();
    }
}
