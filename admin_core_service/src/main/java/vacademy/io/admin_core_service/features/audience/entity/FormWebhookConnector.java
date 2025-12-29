package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

/**
 * Entity representing a form webhook connector configuration
 * 
 * This table stores the mapping between external form providers (Zoho, Google, etc.)
 * and internal audience campaigns.
 * 
 * Key fields:
 * - vendor: Form provider type (ZOHO_FORMS, GOOGLE_FORMS, etc.)
 * - vendor_id: Unique identifier from the form provider (e.g., Zoho form ID)
 * - institute_id: Which institute this form belongs to
 * - audience_id: Which audience/campaign to link submissions to
 * - sample_map_json: JSON mapping configuration for field names
 *   Example: {"Email": "email", "Primary Email": "email", "Phone": "phoneNumber"}
 *   This maps form field names to standardized user fields
 */
@Entity
@Table(name = "form_webhook_connector")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FormWebhookConnector {
    
    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;
    
    /**
     * Form provider vendor type (ZOHO_FORMS, GOOGLE_FORMS, MICROSOFT_FORMS)
     */
    @Column(name = "vendor", nullable = false, length = 50)
    private String vendor;
    
    /**
     * Unique identifier from the form provider
     * For Zoho: This is the Zoho form ID
     * For Google: This would be the Google Form ID
     * This allows multiple forms from the same vendor to map to different campaigns
     */
    @Column(name = "vendor_id", nullable = false, length = 255)
    private String vendorId;
    
    /**
     * Institute ID that owns this form configuration
     */
    @Column(name = "institute_id", nullable = false)
    private String instituteId;
    
    /**
     * Audience/Campaign ID to link form submissions to
     */
    @Column(name = "audience_id", nullable = false)
    private String audienceId;
    
    /**
     * Optional type/category for the connector
     */
    @Column(name = "type", length = 50)
    private String type;
    
    /**
     * JSON mapping configuration for field names
     * 
     * Structure: Maps form field names to standardized fields
     * {
     *   "Email": "email",
     *   "Primary Email": "email",
     *   "Full Name": "fullName",
     *   "Name": "fullName",
     *   "Phone Number": "phoneNumber",
     *   "Mobile": "phoneNumber",
     *   "Company Name": "companyName"
     * }
     * 
     * This allows flexible mapping when different forms use different field names
     * for the same data (e.g., "Email" vs "Primary Email" both map to "email")
     */
    @Column(name = "sample_map_json", columnDefinition = "TEXT")
    private String sampleMapJson;
    
    /**
     * Whether this connector is active
     */
    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;
    
    @Column(name = "created_at", updatable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;
    
    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        updatedAt = new Date();
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }
}
