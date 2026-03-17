package vacademy.io.notification_service.features.combot.action.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.notification_service.features.combot.action.dto.FlowAction;
import vacademy.io.notification_service.features.combot.action.dto.FlowActionConfig;
import vacademy.io.notification_service.features.combot.action.dto.FlowActionRule;
import vacademy.io.notification_service.features.combot.action.dto.FlowContext;
import vacademy.io.notification_service.features.combot.action.executor.FlowActionExecutor;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Routes incoming messages to appropriate action executors based on
 * action_template_config rules.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FlowActionRouter {

    private final ObjectMapper objectMapper;
    private final List<FlowActionExecutor> executors;

    /**
     * Route and execute actions based on the action config and user input.
     * 
     * @param actionConfigJson The action_template_config JSON string
     * @param userText         The user's incoming message text
     * @param context          The flow context with user and channel info
     * @return true if any actions were executed, false otherwise
     */
    public boolean routeActions(String actionConfigJson, String userText, FlowContext context) {
        if (actionConfigJson == null || actionConfigJson.isBlank()) {
            log.debug("No action config provided, skipping action routing");
            return false;
        }

        try {
            FlowActionConfig config = objectMapper.readValue(actionConfigJson, FlowActionConfig.class);

            if (config.getRules() == null || config.getRules().isEmpty()) {
                log.debug("No rules in action config");
                return false;
            }

            // Find matching rule
            FlowActionRule matchedRule = findMatchingRule(config.getRules(), userText);

            if (matchedRule == null) {
                log.debug("No matching rule found for input: {}", truncate(userText, 50));
                return false;
            }

            log.info("Matched rule trigger='{}' for input='{}', executing {} actions",
                    matchedRule.getTrigger(),
                    truncate(userText, 50),
                    matchedRule.getActions() != null ? matchedRule.getActions().size() : 0);

            // Execute all actions for matched rule
            if (matchedRule.getActions() != null) {
                for (FlowAction action : matchedRule.getActions()) {
                    executeAction(action, context);
                }
            }

            return true;

        } catch (Exception e) {
            log.error("Failed to parse or route action config: {}", e.getMessage(), e);
            return false;
        }
    }

    /**
     * Find the first matching rule based on trigger and match type.
     */
    private FlowActionRule findMatchingRule(List<FlowActionRule> rules, String userText) {
        if (userText == null) {
            return null;
        }

        String normalizedInput = userText.trim().toLowerCase();

        for (FlowActionRule rule : rules) {
            if (matchesTrigger(rule, normalizedInput)) {
                return rule;
            }
        }

        // Look for default rule
        for (FlowActionRule rule : rules) {
            if ("default".equalsIgnoreCase(rule.getTrigger())) {
                return rule;
            }
        }

        return null;
    }

    /**
     * Check if user input matches the rule's trigger based on match type.
     */
    private boolean matchesTrigger(FlowActionRule rule, String normalizedInput) {
        String trigger = rule.getTrigger();
        if (trigger == null || "default".equalsIgnoreCase(trigger)) {
            return false;
        }

        String matchType = rule.getMatchType();
        if (matchType == null) {
            matchType = "contains"; // Default match type
        }

        return switch (matchType.toLowerCase()) {
            case "exact" -> normalizedInput.equalsIgnoreCase(trigger);
            case "contains" -> normalizedInput.contains(trigger.toLowerCase());
            case "regex" -> matchesRegex(normalizedInput, trigger);
            default -> normalizedInput.contains(trigger.toLowerCase());
        };
    }

    /**
     * Check if input matches regex pattern.
     */
    private boolean matchesRegex(String input, String regex) {
        try {
            return Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(input).matches();
        } catch (Exception e) {
            log.warn("Invalid regex pattern: {}", regex);
            return false;
        }
    }

    /**
     * Find executor and execute the action.
     */
    private void executeAction(FlowAction action, FlowContext context) {
        for (FlowActionExecutor executor : executors) {
            if (executor.canHandle(action)) {
                log.debug("Executing action type={} with executor={}",
                        action.getType(),
                        executor.getClass().getSimpleName());
                try {
                    executor.execute(action, context);
                } catch (Exception e) {
                    log.error("Action execution failed: type={}, error={}",
                            action.getType(), e.getMessage(), e);
                }
                return;
            }
        }
        log.warn("No executor found for action type: {}", action.getType());
    }

    private String truncate(String text, int maxLength) {
        if (text == null)
            return null;
        return text.length() <= maxLength ? text : text.substring(0, maxLength) + "...";
    }
}
