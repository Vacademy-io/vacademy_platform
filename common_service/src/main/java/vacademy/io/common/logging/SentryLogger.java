package vacademy.io.common.logging;

import io.sentry.Sentry;
import io.sentry.SentryEvent;
import io.sentry.SentryLevel;
import io.sentry.protocol.Message;
import lombok.extern.slf4j.Slf4j;

import java.util.Map;

/**
 * Utility class for Sentry logging with contextual metadata.
 * This provides a simplified API for sending structured logs to Sentry
 * with automatic tagging and error details.
 * 
 * Compatible with Sentry SDK 7.15.0+
 */
@Slf4j
public class SentryLogger {

    /**
     * Log an error to Sentry with contextual tags
     *
     * @param exception    The exception to log
     * @param errorMessage Human-readable error message
     * @param tags         Map of tags to attach to the event
     */
    public static void logError(Throwable exception, String errorMessage, Map<String, String> tags) {
        try {
            SentryEvent event = new SentryEvent(exception);
            event.setLevel(SentryLevel.ERROR);

            Message message = new Message();
            message.setMessage(errorMessage);
            event.setMessage(message);

            if (tags != null) {
                tags.forEach(event::setTag);
            }

            Sentry.captureEvent(event);
        } catch (Exception e) {
            log.error("Failed to send error to Sentry", e);
        }
    }

    /**
     * Log an error to Sentry without tags
     *
     * @param exception    The exception to log
     * @param errorMessage Human-readable error message
     */
    public static void logError(Throwable exception, String errorMessage) {
        logError(exception, errorMessage, null);
    }

    /**
     * Log a warning to Sentry with contextual tags
     *
     * @param warningMessage Warning message
     * @param tags           Map of tags to attach to the event
     */
    public static void logWarning(String warningMessage, Map<String, String> tags) {
        try {
            SentryEvent event = new SentryEvent();
            event.setLevel(SentryLevel.WARNING);

            Message message = new Message();
            message.setMessage(warningMessage);
            event.setMessage(message);

            if (tags != null) {
                tags.forEach(event::setTag);
            }

            Sentry.captureEvent(event);
        } catch (Exception e) {
            log.error("Failed to send warning to Sentry", e);
        }
    }

    /**
     * Log a warning to Sentry with an exception
     *
     * @param exception      The exception that triggered the warning
     * @param warningMessage Warning message
     * @param tags           Map of tags to attach to the event
     */
    public static void logWarning(Throwable exception, String warningMessage, Map<String, String> tags) {
        try {
            SentryEvent event = new SentryEvent(exception);
            event.setLevel(SentryLevel.WARNING);

            Message message = new Message();
            message.setMessage(warningMessage);
            event.setMessage(message);

            if (tags != null) {
                tags.forEach(event::setTag);
            }

            Sentry.captureEvent(event);
        } catch (Exception e) {
            log.error("Failed to send warning to Sentry", e);
        }
    }

    /**
     * Log an info message to Sentry with contextual tags
     *
     * @param infoMessage Info message
     * @param tags        Map of tags to attach to the event
     */
    public static void logInfo(String infoMessage, Map<String, String> tags) {
        try {
            SentryEvent event = new SentryEvent();
            event.setLevel(SentryLevel.INFO);

            Message message = new Message();
            message.setMessage(infoMessage);
            event.setMessage(message);

            if (tags != null) {
                tags.forEach(event::setTag);
            }

            Sentry.captureEvent(event);
        } catch (Exception e) {
            log.error("Failed to send info to Sentry", e);
        }
    }

    /**
     * Builder class for creating tagged Sentry events
     */
    public static class SentryEventBuilder {
        private final SentryEvent event;
        private final Message message;

        private SentryEventBuilder(SentryLevel level) {
            this.event = new SentryEvent();
            this.message = new Message();
            this.event.setLevel(level);
        }

        private SentryEventBuilder(Throwable exception, SentryLevel level) {
            this.event = new SentryEvent(exception);
            this.message = new Message();
            this.event.setLevel(level);
        }

        public static SentryEventBuilder error(Throwable exception) {
            return new SentryEventBuilder(exception, SentryLevel.ERROR);
        }

        public static SentryEventBuilder error() {
            return new SentryEventBuilder(SentryLevel.ERROR);
        }

        public static SentryEventBuilder warning(Throwable exception) {
            return new SentryEventBuilder(exception, SentryLevel.WARNING);
        }

        public static SentryEventBuilder warning() {
            return new SentryEventBuilder(SentryLevel.WARNING);
        }

        public static SentryEventBuilder info() {
            return new SentryEventBuilder(SentryLevel.INFO);
        }

        public SentryEventBuilder withMessage(String msg) {
            this.message.setMessage(msg);
            return this;
        }

        public SentryEventBuilder withTag(String key, String value) {
            this.event.setTag(key, value);
            return this;
        }

        public SentryEventBuilder withTags(Map<String, String> tags) {
            if (tags != null) {
                tags.forEach(this.event::setTag);
            }
            return this;
        }

        public void send() {
            try {
                this.event.setMessage(this.message);
                Sentry.captureEvent(this.event);
            } catch (Exception e) {
                log.error("Failed to send event to Sentry", e);
            }
        }
    }
}
