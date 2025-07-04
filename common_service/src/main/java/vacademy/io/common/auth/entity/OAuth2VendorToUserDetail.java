package vacademy.io.common.auth.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Getter
@Setter
@Table(name = "oauth2_vendor_to_user_detail")
public class OAuth2VendorToUserDetail {
    @Id
    @UuidGenerator
    private String id;
    private String emailId;
    private String providerId;
    private String subject;
}
