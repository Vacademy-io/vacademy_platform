package vacademy.io.admin_core_service.features.translation.dto;

import java.sql.Timestamp;

/**
 * Native-query projection for one review item row from the UNION of the two
 * text sidecar tables (rich_text_translation / entity_field_translation).
 * Aliases in the query are camelCase (Postgres folds to lowercase; Spring's
 * projection lookup is case-insensitive).
 */
public interface TranslationReviewItemProjection {

    /** RICH_TEXT | ENTITY_FIELD ("table" is reserved in SQL, hence itemTable). */
    String getItemTable();

    String getId();

    String getState();

    String getTranslatedContent();

    /** Canonical (source-locale) content where cheap to fetch, else null. */
    String getBaseContent();

    String getEntityType();

    String getEntityId();

    String getField();

    String getRichTextId();

    String getTranslatedBy();

    Timestamp getUpdatedAt();
}
