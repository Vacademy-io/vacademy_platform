package vacademy.io.assessment_service.features.tags.entities;

import jakarta.persistence.Entity;
import jakarta.persistence.*;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Date;

@Entity
@Table(name = "tags")
@Data
@EqualsAndHashCode(of = "tagId")
public class Tag {
    
    @Id
    @Column(name = "tag_id")
    private String tagId;
    
    @Column(name = "tag_name", unique = true, nullable = false)
    private String tagName;
    
    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;
    
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}