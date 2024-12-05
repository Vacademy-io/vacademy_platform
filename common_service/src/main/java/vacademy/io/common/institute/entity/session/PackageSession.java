package vacademy.io.common.institute.entity.session;

import jakarta.persistence.*;


import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;

import java.util.*;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "package_session")

public class PackageSession {

    @Id
    @Column(name = "id")
    @UuidGenerator
    private String id;

    @JoinColumn(name = "level_id")
    @ManyToOne
    private Level level;

    @JoinColumn(name = "session_id")
    @ManyToOne
    private Session session;

    @Column(name = "start_time")
    private Date startTime;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "status")
    private String status;

    @JoinColumn(name = "package_id")
    @ManyToOne
    private PackageEntity packageEntity;

}