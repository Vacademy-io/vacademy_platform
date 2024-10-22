package vacademy.io.common.auth.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Data
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "USER_ACTIVITY")
public class UserActivity {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    private String route;
    private String origin;
    private String userId;
    private String clientIp;

    @Column(name = "updated_on", insertable = false, updatable = false)
    private Date updatedOn;

    @Column(name = "created_on", insertable = false, updatable = false)
    private Date createdOn;

}