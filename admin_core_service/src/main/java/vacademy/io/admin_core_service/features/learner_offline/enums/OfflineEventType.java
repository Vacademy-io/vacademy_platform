package vacademy.io.admin_core_service.features.learner_offline.enums;

/**
 * Kind of offline event carried in a POST .../offline-sync/v1/batch request
 * (offline plan, Part A4). Maps 1:1 to which existing tracking service
 * OfflineSyncEventProcessor dispatches the event's payload to.
 */
public enum OfflineEventType {
    VIDEO,
    DOCUMENT,
    HTML_VIDEO,
    AUDIO,
    QUESTION,
    QUIZ,
    ASSIGNMENT,
    DOWNLOAD_STATE
}
