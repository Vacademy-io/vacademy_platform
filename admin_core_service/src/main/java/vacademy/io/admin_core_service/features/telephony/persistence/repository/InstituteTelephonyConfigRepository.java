package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.enums.ConfigRole;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;

import java.util.List;
import java.util.Optional;

@Repository
public interface InstituteTelephonyConfigRepository
        extends JpaRepository<InstituteTelephonyConfig, String> {

    /**
     * The one row for this (institute, role). Since V448 an institute may hold a
     * second {@code AI_VOICE} row, so there is deliberately NO
     * {@code findByInstituteId} returning an {@code Optional} — that derived query
     * would throw {@code IncorrectResultSizeDataAccessException} the moment an
     * institute gained an AI carrier, taking its human calling down with it. Every
     * caller must say which role it means; {@link #findPrimaryByInstituteId} is what
     * the old method meant.
     */
    Optional<InstituteTelephonyConfig> findByInstituteIdAndRole(String instituteId, String role);

    /** Every config row for the institute (PRIMARY + optional AI_VOICE). */
    List<InstituteTelephonyConfig> findAllByInstituteId(String instituteId);

    /** The provider this institute's humans click-to-call on. */
    default Optional<InstituteTelephonyConfig> findPrimaryByInstituteId(String instituteId) {
        return findByInstituteIdAndRole(instituteId, ConfigRole.PRIMARY);
    }

    /**
     * The institute's dedicated AI-calling line, if it has one. Absent for every
     * institute whose AI calls ride the primary provider (the normal case when that
     * provider is already Vacademy Voice).
     */
    default Optional<InstituteTelephonyConfig> findAiVoiceByInstituteId(String instituteId) {
        return findByInstituteIdAndRole(instituteId, ConfigRole.AI_VOICE);
    }

    /**
     * All configs for a provider type (e.g. AIRTEL) — a tiny set (one per
     * institute that uses it). The CDR/recording promoter loads these and matches
     * the S3 import's account id against each config's parsed provider_config JSON
     * in Java. (We deliberately do NOT match the account id in SQL: the account id
     * lives in the generic provider_config JSON, and a brace-guarded
     * {@code ::jsonb} native query trips Hibernate's "{alias}" path parser —
     * "Unmatched braces for alias path".)
     */
    List<InstituteTelephonyConfig> findByProviderType(String providerType);
}
