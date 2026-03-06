package vacademy.io.admin_core_service.features.user_subscription.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.user_subscription.dto.ReferralOptionDTO;

import java.util.Date;

@Entity
@Table(name = "referral_option")
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class ReferralOption {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "name")
    private String name;

    @Column(name = "source", nullable = false)
    private String source;

    @Column(name = "source_id")
    private String sourceId;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "referrer_discount_json", columnDefinition = "TEXT")
    private String referrerDiscountJson;

    @Column(name = "referee_discount_json", columnDefinition = "TEXT")
    private String refereeDiscountJson;

    @Column(name = "referrer_vesting_days")
    private Integer referrerVestingDays;

    @Column(name = "tag")
    private String tag;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "setting_json", columnDefinition = "TEXT")
    private String settingJson;

    // --- NEW FIELD ADDED HERE ---
    @Column(name = "allow_combine_offers", columnDefinition = "boolean default false")
    private Boolean allowCombineOffers = false;

    @CreationTimestamp
    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Temporal(TemporalType.TIMESTAMP)
    @Column(name = "updated_at")
    private Date updatedAt;

    public ReferralOption(ReferralOptionDTO referralOptionDTO){
        this.id = referralOptionDTO.getId();
        this.name = referralOptionDTO.getName();
        this.source = referralOptionDTO.getSource();
        this.sourceId = referralOptionDTO.getSourceId();
        this.status = referralOptionDTO.getStatus();
        this.referrerDiscountJson = referralOptionDTO.getReferrerDiscountJson();
        this.refereeDiscountJson = referralOptionDTO.getRefereeDiscountJson();
        this.referrerVestingDays = referralOptionDTO.getReferrerVestingDays();
        this.description = referralOptionDTO.getDescription();
        this.tag = referralOptionDTO.getTag();
        this.settingJson = referralOptionDTO.getSettingJson();
        // Null check to prevent NullPointerException if older DTOs don't send this field
        this.allowCombineOffers = referralOptionDTO.getAllowCombineOffers() != null 
                                  ? referralOptionDTO.getAllowCombineOffers() 
                                  : false;
    }

    public ReferralOptionDTO toReferralOptionDTO(){
        return ReferralOptionDTO.builder()
                .id(id)
                .name(name)
                .source(source)
                .sourceId(sourceId)
                .status(status)
                .referrerDiscountJson(referrerDiscountJson)
                .refereeDiscountJson(refereeDiscountJson)
                .referrerVestingDays(referrerVestingDays)
                .tag(tag)
                .createdAt(createdAt)
                .description(description)
                .updatedAt(updatedAt)
                .settingJson(settingJson)
                .allowCombineOffers(allowCombineOffers)
                .build();
    }
}