package vacademy.io.notification_service.features.email_otp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity(name = "email_otp")
@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class EmailOtp {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "email")
    private String email;

    @Column(name = "otp")
    private String otp;

    @Column(name = "service")
    private String service;

    @Builder.Default
    @Column(name = "is_verified")
    private String isVerified = "false";

    @Column(name = "phone_number", length = 20)
    private String phoneNumber;

    @Builder.Default
    @Column(name = "type", length = 20)
    private String type = "EMAIL";

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

}