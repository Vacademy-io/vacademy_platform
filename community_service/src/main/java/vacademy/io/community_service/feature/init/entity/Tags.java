package vacademy.io.community_service.feature.init.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Data
@Table(name = "tags")
public class Tags {
    @Id
    @Column(name = "tag_id")
    private String tagId;

    @Column(name = "tag_name", unique = true, nullable = false)
    private String tagName;


}
