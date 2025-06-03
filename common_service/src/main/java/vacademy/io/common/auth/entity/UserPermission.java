package vacademy.io.common.auth.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "user_permission")
@Getter
@Setter
public class UserPermission {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    private String userId;
    private String permissionId;
    private String instituteId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
