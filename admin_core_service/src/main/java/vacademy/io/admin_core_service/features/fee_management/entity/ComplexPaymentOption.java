package vacademy.io.admin_core_service.features.fee_management.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "complex_payment_option")
public class ComplexPaymentOption {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "default_payment_option_id")
    private String defaultPaymentOptionId;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "metadata_json", columnDefinition = "TEXT")
    private String metadataJson;
}
