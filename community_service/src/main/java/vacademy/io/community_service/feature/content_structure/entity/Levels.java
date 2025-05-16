package vacademy.io.community_service.feature.content_structure.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

import java.util.Set;

@Entity
@Data
@Table(name = "levels")
public class Levels {
    @Id
    @Column(name = "level_id")
    private String levelId;

    @Column(name = "level_name", unique = true, nullable = false)
    private String levelName;

    @ManyToMany
    @JsonIgnore
    @JoinTable(
            name = "level_stream_mapping",
            joinColumns = @JoinColumn(name = "level_id"),
            inverseJoinColumns = @JoinColumn(name = "stream_id")
    )
    private Set<Streams> streams;

}
