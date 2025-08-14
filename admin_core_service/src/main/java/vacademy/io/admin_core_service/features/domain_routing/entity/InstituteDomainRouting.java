package vacademy.io.admin_core_service.features.domain_routing.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

@Entity
@Table(name = "institute_domain_routing")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstituteDomainRouting {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "domain", nullable = false)
    private String domain;

    @Column(name = "subdomain", nullable = false)
    private String subdomain;

    // Role name such as ADMIN, TEACHER, LEARNER
    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;
}


