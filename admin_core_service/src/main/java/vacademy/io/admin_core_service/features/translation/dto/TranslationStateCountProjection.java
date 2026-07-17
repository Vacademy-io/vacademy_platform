package vacademy.io.admin_core_service.features.translation.dto;

/** Native-query projection: rows per translation state with a count. */
public interface TranslationStateCountProjection {
    String getState();

    Long getCnt();
}
