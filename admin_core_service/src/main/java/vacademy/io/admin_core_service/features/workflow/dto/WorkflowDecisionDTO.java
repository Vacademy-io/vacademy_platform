package vacademy.io.admin_core_service.features.workflow.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * One human decision the assistive drafter needs before it can finish a workflow (see
 * WORKFLOW_AI_ASSISTIVE_DESIGN.md §2.2). The frontend renders each via the SAME picker the
 * manual builder uses — either from inline {@code options} or by calling the hook named in
 * {@code optionSource}. On BUILD, the backend maps the answer onto the skeleton at
 * ({@code nodeId}, {@code field}).
 *
 * Phase A kinds: ENTITY_PICKER, EMAIL_TEMPLATE, WHATSAPP_TEMPLATE, TEMPLATE_VAR_MAP.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowDecisionDTO {
    private String id;
    private String kind;
    private String prompt;
    private String stepId;
    /** node in the skeleton this decision fills (null for trigger-scoped decisions). */
    private String nodeId;
    /** dot-path the answer is written to, e.g. config.templateName, trigger.event_ids, config.params.audienceId. */
    private String field;
    private boolean multi;
    private boolean required;
    /** closed AI-authored option set; null means load via optionSource. */
    private List<Option> options;
    private OptionSource optionSource;
    /** ids of decisions that must be answered first (e.g. var-map depends on the template pick). */
    private List<String> dependsOn;
    private Object defaultValue;
    private String help;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Option {
        private String value;
        private String label;
        private String subtitle;
    }

    /** Tells the FE which existing TanStack Query hook / picker loads the real institute options. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OptionSource {
        private String hook;             // e.g. "EventEntityPicker", "getTemplatesByType"
        private Map<String, Object> args; // e.g. {eventAppliedType: AUDIENCE} or {type: WHATSAPP}
        private String valueField;
        private String labelField;
    }
}
