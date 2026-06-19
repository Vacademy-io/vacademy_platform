package vacademy.io.admin_core_service.features.ai_usage.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTOs for the per-user AI credit usage views (academy-credits).
 * All values are derived from credit_transactions (net of refunds) joined to
 * the institute user directory (users / user_role / roles).
 */
public class CreditUsageDtos {

    /** One row in the per-user usage list. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UserUsageRow {
        private String userId;
        private String name;
        private String email;
        /** Comma-separated role names the user holds in this institute. */
        private String roles;
        private double totalCredits;
        private long requestCount;
    }

    /** One credit deduction in a user's drill-down log. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class UsageLogRow {
        private String id;
        /** Epoch millis. */
        private Long createdAt;
        private String requestType;
        private String model;
        private double credits;
        private String description;
    }

    /** Per-role rollup used to build the role sub-tabs (with counts). */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RoleSummaryRow {
        private String role;
        private long userCount;
        private double totalCredits;
    }

    /**
     * One Student-AI chat session in a learner's conversation drill-down.
     * Sourced from chat_sessions (+ a cheap COUNT/first-message subquery on
     * chat_messages). These tables are written by the Python ai_service into
     * the SAME database admin_core uses, so we read them with a native query —
     * the same posture as the credit_transactions reader.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ConversationRow {
        private String sessionId;
        /** slide | question | course_details | general etc. */
        private String contextType;
        /** Best-effort human label pulled from context_meta (may be null). */
        private String contextTitle;
        /** text | voice_interview | voice_doubt | voice_oral_test */
        private String sessionMode;
        private String status;
        /** Epoch millis. */
        private Long createdAt;
        /** Epoch millis. */
        private Long lastActive;
        private long messageCount;
        /** First learner message, trimmed — a preview for the session list. */
        private String preview;
    }

    /** One message inside a chat session transcript. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChatMessageRow {
        private String id;
        /** user | assistant | tool_call | tool_result */
        private String type;
        private String content;
        /** Raw metadata JSON (intent, quiz payload, …) — may be null. */
        private String metadata;
        /** Epoch millis. */
        private Long createdAt;
    }

    /**
     * One credit deduction across the whole institute, with the member it's
     * attributed to resolved — a flat row for the admin "Activity Log" export.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FlatLogRow {
        /** Epoch millis. */
        private Long createdAt;
        private String userId;
        private String name;
        private String email;
        /** Comma-separated role names. */
        private String roles;
        private String requestType;
        private String model;
        private double credits;
        private String description;
    }
}
