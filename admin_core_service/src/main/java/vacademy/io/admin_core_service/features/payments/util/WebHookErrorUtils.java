package vacademy.io.admin_core_service.features.payments.util;

import java.util.HashSet;
import java.util.Set;

/**
 * Utilities for producing diagnosable error messages when storing webhook
 * failures in {@code web_hook.error_message}.
 *
 * <p>The default {@link Throwable#getMessage()} is often unhelpful when the
 * top-level exception is a Spring/JDBC wrapper such as
 * {@code UnexpectedRollbackException} — its message is just
 * "Transaction silently rolled back…" without naming what actually threw.
 * {@link #describeException(Throwable)} walks the cause chain to surface the
 * root cause along with the wrapper.
 */
public final class WebHookErrorUtils {

    private static final int MAX_LENGTH = 4000;

    private WebHookErrorUtils() {
    }

    /**
     * Builds an error message that names the root cause's class and message so
     * it's actually diagnosable when stored in {@code web_hook.error_message}.
     *
     * Format: {@code "<RootCauseClass>: <root message> [via <OuterClass>: <outer message>]"}.
     * The trailing "[via …]" is included only when the root cause differs from
     * the top-level exception. Truncated to 4000 chars.
     */
    public static String describeException(Throwable t) {
        if (t == null) {
            return "Unknown error (null exception)";
        }
        Throwable root = t;
        Set<Throwable> seen = new HashSet<>();
        while (root.getCause() != null && root.getCause() != root && seen.add(root)) {
            root = root.getCause();
        }
        String rootMsg = root.getMessage() != null ? root.getMessage() : "(no message)";
        StringBuilder sb = new StringBuilder()
                .append(root.getClass().getSimpleName())
                .append(": ")
                .append(rootMsg);
        if (root != t) {
            sb.append(" [via ")
              .append(t.getClass().getSimpleName());
            if (t.getMessage() != null) {
                sb.append(": ").append(t.getMessage());
            }
            sb.append("]");
        }
        String description = sb.toString();
        if (description.length() > MAX_LENGTH) {
            description = description.substring(0, MAX_LENGTH - 3) + "...";
        }
        return description;
    }
}
