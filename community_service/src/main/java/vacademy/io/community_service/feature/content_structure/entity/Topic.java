package vacademy.io.community_service.feature.content_structure.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;

import java.util.HashSet;
import java.util.Set;

@Entity
@Data
@Table(name = "topic")
public class Topic {

    @Id
    @UuidGenerator
    @Column(name = "topic_id")
    private String topicId;

    @Column(name = "topic_name", unique = true, nullable = false)
    private String topicName;

    @Column(name = "topic_order", nullable = false)
    private Integer topicOrder;

    @ManyToMany(mappedBy = "topics")
    @JsonIgnore
    private Set<Chapter> chapters = new HashSet<>();

}
