package vacademy.io.common.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "user_hierarchy")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserHierarchy {
    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;
    @Column(name = "user_id")
    private String userId;
    @Column(name = "user_type")
    private String userType;
    @Column(name = "parent_user_id")
    private String parentUserId;
    @Column(name = "parent_user_type")
    private String parentUserType;
    @Column(name = "site_id")
    private String siteId;
    @Column(name = "updated_on", insertable = false, updatable = false)
    private Date updatedOn;
    @Column(name = "created_on", insertable = false, updatable = false)
    private Date createdOn;
}
