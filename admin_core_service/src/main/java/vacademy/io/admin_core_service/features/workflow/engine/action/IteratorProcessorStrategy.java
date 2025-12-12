package vacademy.io.admin_core_service.features.workflow.engine.action;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.common.util.JsonUtil;
import vacademy.io.admin_core_service.features.notification.dto.WhatsappRequest;
import vacademy.io.admin_core_service.features.workflow.dto.ForEachConfigDTO;
import vacademy.io.admin_core_service.features.workflow.dto.IteratorConfigDTO;
import vacademy.io.admin_core_service.features.workflow.engine.HttpRequestNodeHandler;
import vacademy.io.admin_core_service.features.workflow.engine.QueryNodeHandler;
import vacademy.io.admin_core_service.features.workflow.spel.SpelEvaluator;
import vacademy.io.admin_core_service.features.workflow.dto.execution_log.IteratorExecutionDetails;

import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class IteratorProcessorStrategy implements DataProcessorStrategy {

    private final ObjectMapper objectMapper;
    private final SpelEvaluator spelEvaluator;
    private final QueryNodeHandler.QueryService queryService;
    private final HttpRequestNodeHandler httpRequestNodeHandler;

    // ThreadLocal context stack for managing nested iteration scopes.
    private final ThreadLocal<Stack<Map<String, Object>>> contextStack = ThreadLocal.withInitial(Stack::new);

    public static final String EXECUTION_DETAILS_KEY = "__iteratorExecutionDetails";

    @Override
    public boolean canHandle(String operation) {
        return "ITERATOR".equalsIgnoreCase(operation);
    }

    @Override
    public Map<String, Object> execute(Map<String, Object> context, Object config, Map<String, Object> itemContext) {
        Map<String, Object> changes = new HashMap<>();

        // Ensure the context stack is clean before starting a new top-level iteration.
        contextStack.get().clear();
        contextStack.get().push(new HashMap<>(context));

        IteratorExecutionDetails.IteratorExecutionDetailsBuilder detailsBuilder = IteratorExecutionDetails.builder()
                .inputContext(null); // Minimize data: do not store full context

        try {
            IteratorConfigDTO iteratorConfig = objectMapper.convertValue(config, IteratorConfigDTO.class);

            // Evaluate the collection expression against the current context.
            String onExpr = iteratorConfig.getOn();
            detailsBuilder.collectionExpression(onExpr);

            Object listObj = evaluateWithStackedContext(onExpr, context);

            if (!(listObj instanceof Collection<?> list) || list.isEmpty()) {
                log.debug("Iterator expression '{}' evaluated to null or an empty collection.", onExpr);
                changes.put("iterator_completed", true);
                changes.put("item_count", 0);

                detailsBuilder.totalItems(0).successCount(0).failureCount(0);
                changes.put(EXECUTION_DETAILS_KEY, detailsBuilder.build());

                return changes;
            }

            detailsBuilder.totalItems(list.size());

            List<Map<String, Object>> processedItems = new ArrayList<>();
            int index = 0;
            int successCount = 0;

            for (Object item : list) {
                // Create a new context for this specific iteration.
                Map<String, Object> loopContext = new HashMap<>(context);
                loopContext.put("item", item);
                loopContext.put("index", index);

                contextStack.get().push(loopContext);
                try {
                    Map<String, Object> itemResult = processForEachOperation(iteratorConfig.getForEach(), loopContext,
                            item);

                    // Check for error in itemResult (some operations might return error map instead
                    // of throwing)
                    if (itemResult.containsKey("error")) {
                        throw new RuntimeException(String.valueOf(itemResult.get("error")));
                    }

                    processedItems.add(itemResult);
                    context.putAll(itemResult);
                    log.debug("Processed item in iterator: {} with result: {}", item, itemResult);
                    successCount++;
                } catch (Exception e) {
                    // Capture failure details
                    IteratorExecutionDetails.FailedItem failedItem = IteratorExecutionDetails.FailedItem.builder()
                            .index(index)
                            .itemData(item) // Note: might need sanitization later
                            .errorMessage(e.getMessage())
                            .errorType(e.getClass().getSimpleName())
                            .contextAtFailure(new HashMap<>(loopContext)) // Snapshot
                            .failedOperation(
                                    iteratorConfig.getForEach() != null ? iteratorConfig.getForEach().getOperation()
                                            : "UNKNOWN")
                            .build();

                    detailsBuilder.failedItems(List.of(failedItem));
                    detailsBuilder.failureCount(1); // We abort on first failure
                    detailsBuilder.successCount(successCount);

                    changes.put(EXECUTION_DETAILS_KEY, detailsBuilder.build());

                    throw e; // Re-throw to stop execution
                } finally {
                    // Pop the context for the current iteration.
                    contextStack.get().pop();
                    index++;
                }
            }

            changes.put("processed_items", processedItems);
            changes.put("item_count", list.size());
            changes.put("iterator_completed", true);

            detailsBuilder.successCount(successCount).failureCount(0);
            changes.put(EXECUTION_DETAILS_KEY, detailsBuilder.build());

        } catch (Exception e) {
            log.error("Error executing Iterator processor", e);
            changes.put("iterator_error", e.getMessage());
            changes.put("iterator_completed", false);

            // If detailsBuilder was not built yet (exception before loop or re-thrown from
            // loop)
            if (!changes.containsKey(EXECUTION_DETAILS_KEY)) {
                // If it was re-thrown, we already put it in changes.
                // If it was before loop, we need to put it.
                // But we can't easily check if it's already there because we are in catch block
                // of outer try.
                // Actually we can check changes map.
            }
            // If the exception came from outside the loop (e.g. bad config), we should log
            // it.
            if (!changes.containsKey(EXECUTION_DETAILS_KEY)) {
                detailsBuilder.failureCount(1).successCount(0); // Assuming 0 success if failed before loop
                // We don't have failed item details here easily unless we track it.
                changes.put(EXECUTION_DETAILS_KEY, detailsBuilder.build());
            }
        } finally {
            // Clean up the context stack.
            contextStack.remove();
        }

        return changes;
    }

    /**
     * Processes the forEach operation which defines what to do for each item in the
     * collection.
     */
    private Map<String, Object> processForEachOperation(ForEachConfigDTO forEachConfig, Map<String, Object> loopContext,
            Object item) {
        if (forEachConfig == null) {
            log.warn("No 'forEach' configuration found in iterator.");
            return new HashMap<>();
        }

        String operation = forEachConfig.getOperation();
        if (operation == null || operation.isBlank()) {
            log.warn("No operation specified in 'forEach' configuration.");
            return new HashMap<>();
        }

        try {
            return switch (operation.toUpperCase()) {
                case "ITERATOR" -> processNestedIteratorOperation(forEachConfig, loopContext, 1);
                case "QUERY" -> processQueryOperation(forEachConfig, loopContext, item);
                case "OBJECT_PARSER" -> parseObject(forEachConfig, loopContext, item);
                case "SEND_WHATSAPP" -> processSendWhatsAppOperation(forEachConfig, loopContext);
                case "SWITCH" -> processSwitchOperation(forEachConfig, loopContext, item);
                case "HTTP_REQUEST" -> processHttpRequestOperation(forEachConfig, loopContext);
                case "SPEL_EVALUATOR" -> {
                    // Handle SPEL_EVALUATOR by reading from the raw map
                    String evalVarName = (String) forEachConfig.getEval();
                    String computeExpr = (String) forEachConfig.getCompute();
                    yield processSpelEvaluatorOperation(evalVarName, computeExpr, loopContext, item);
                }
                default -> {
                    log.warn("Unknown operation type in iterator: {}", operation);
                    yield Map.of("operation", operation, "status", "unknown_operation");
                }
            };
        } catch (Exception e) {
            log.error("Error processing forEach operation '{}'", operation, e);
            // Throwing exception to be caught by the loop
            throw new RuntimeException("Error in operation " + operation + ": " + e.getMessage(), e);
        }
    }

    /**
     * Merges all contexts from the stack and evaluates a SpEL expression.
     * This allows expressions to access variables from parent loops (e.g., #item,
     * #index).
     */
    private Object evaluateWithStackedContext(String expression, Map<String, Object> currentContext) {
        if (expression == null)
            return null;

        Map<String, Object> mergedContext = new HashMap<>();
        // Iterate from the bottom of the stack to the top to layer contexts correctly.
        for (Map<String, Object> contextLayer : contextStack.get()) {
            mergedContext.putAll(contextLayer);
        }
        mergedContext.putAll(currentContext); // The current context has the highest priority.

        return spelEvaluator.evaluate(expression, mergedContext);
    }

    /**
     * Handles nested iterators.
     */
    private Map<String, Object> processNestedIteratorOperation(ForEachConfigDTO forEachConfig,
            Map<String, Object> loopContext, int nestedIndex) {
        Map<String, Object> result = new HashMap<>();
        IteratorConfigDTO nestedIteratorConfig = objectMapper.convertValue(forEachConfig, IteratorConfigDTO.class);
        String nestedOnExpr = nestedIteratorConfig.getOn();

        if (nestedOnExpr == null) {
            log.warn("Nested iterator is missing the 'on' expression.");
            return Map.of("status", "error", "error", "missing_on_expression");
        }

        Object nestedListObj = evaluateWithStackedContext(nestedOnExpr, loopContext);
        if (!(nestedListObj instanceof Collection<?> nestedList) || nestedList.isEmpty()) {
            log.debug("Nested iterator found nothing for expression: {}", nestedOnExpr);
            return Map.of("status", "no_items", "item_count", 0);
        }

        List<Map<String, Object>> nestedProcessedItems = new ArrayList<>();
        for (Object nestedItem : nestedList) {
            Map<String, Object> nestedLoopContext = new HashMap<>(loopContext);
            nestedLoopContext.put("item" + nestedIndex, nestedItem);
            contextStack.get().push(nestedLoopContext);
            try {
                nestedProcessedItems
                        .add(processForEachOperation(nestedIteratorConfig.getForEach(), nestedLoopContext, nestedItem));
            } finally {
                contextStack.get().pop();
            }
        }

        result.put("status", "success");
        result.put("nested_processed_items", nestedProcessedItems);
        result.put("nested_item_count", nestedList.size());
        return result;
    }

    /**
     * Executes a pre-built query.
     */
    private Map<String, Object> processQueryOperation(ForEachConfigDTO forEachConfig, Map<String, Object> loopContext,
            Object item) {
        String prebuiltKey = forEachConfig.getPrebuiltKey();
        if (prebuiltKey == null || prebuiltKey.isBlank()) {
            log.warn("QUERY operation missing prebuiltKey.");
            return Map.of("status", "error", "error", "missing_prebuilt_key");
        }
        if (prebuiltKey.equalsIgnoreCase("checkStudentIsPresentInPackageSession")) {
            System.out.println("checkStudentIsPresentInPackageSession");
        }
        Map<String, Object> processedParams = new HashMap<>();
        if (forEachConfig.getParams() != null) {
            forEachConfig.getParams().forEach((key, value) -> {
                Object processedValue = (value instanceof String)
                        ? evaluateWithStackedContext((String) value, loopContext)
                        : value;
                processedParams.put(key, processedValue);
            });
        }

        log.info("Executing QUERY: {} with params: {}", prebuiltKey, processedParams);
        Map<String, Object> queryResult = queryService.execute(prebuiltKey, processedParams);

        // Safely update the item if it's a Map
        if (item instanceof Map) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = (Map<String, Object>) item;
                map.putAll(queryResult); // Add query results back to the item
            } catch (ClassCastException e) {
                log.warn("Item is a Map, but not of type Map<String, Object>. Cannot update item.", e);
            }
        }

        return Map.of("status", "success", "prebuiltKey", prebuiltKey, "queryResult", queryResult);
    }

    /**
     * Parses an object in-place, evaluating SpEL expressions within its string
     * values.
     */
    private Map<String, Object> parseObject(ForEachConfigDTO forEachConfig, Map<String, Object> context,
            Object itemToUpdate) {
        if (!(itemToUpdate instanceof Map)) {
            log.error("OBJECT_PARSER expected itemToUpdate to be a Map but got: {}",
                    itemToUpdate != null ? itemToUpdate.getClass().getName() : "null");
            return Map.of("status", "error", "error", "Item to parse is not a Map.");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> mapToUpdate = (Map<String, Object>) itemToUpdate;

        log.debug("Starting in-place parsing for item: {}", mapToUpdate);
        for (Map.Entry<String, Object> entry : mapToUpdate.entrySet()) {
            if (entry.getValue() instanceof String) {
                Object evaluatedValue = evaluateWithStackedContext((String) entry.getValue(), context);
                entry.setValue(evaluatedValue);
            }
        }
        log.info("Finished in-place parsing. Item is now: {}", mapToUpdate);
        return mapToUpdate;
    }

    /**
     * Handles sending WhatsApp messages.
     */
    private Map<String, Object> processSendWhatsAppOperation(ForEachConfigDTO forEachConfig,
            Map<String, Object> loopContext) {
        String onExpr = forEachConfig.getOn();
        if (onExpr == null || onExpr.isBlank()) {
            log.warn("SEND_WHATSAPP operation missing 'on' expression.");
            return Map.of("status", "missing_on_expression");
        }

        Object templatesObj = evaluateWithStackedContext(onExpr, loopContext);
        if (templatesObj == null) {
            log.warn("No templates found for expression: {}", onExpr);
            return Map.of("status", "no_templates_found");
        }

        List<Map<String, Object>> whatsappRequests = processTemplatesAndCreateRequests(templatesObj, loopContext);

        if (!whatsappRequests.isEmpty()) {
            return Map.of("whatsapp_requests", whatsappRequests, "request_count", whatsappRequests.size(), "status",
                    "requests_created");
        } else {
            return Map.of("status", "no_requests_created");
        }
    }

    private List<Map<String, Object>> processTemplatesAndCreateRequests(Object templatesObj,
            Map<String, Object> itemContext) {
        if (templatesObj instanceof Collection<?> templatesCollection) {
            return templatesCollection.stream()
                    .map(template -> createWhatsAppRequest(template, itemContext))
                    .filter(Objects::nonNull)
                    .map(this::convertWhatsappRequestToMap)
                    .toList();
        } else {
            WhatsappRequest request = createWhatsAppRequest(templatesObj, itemContext);
            return request != null ? List.of(convertWhatsappRequestToMap(request)) : Collections.emptyList();
        }
    }

    private WhatsappRequest createWhatsAppRequest(Object template, Map<String, Object> itemContext) {
        if (!(template instanceof Map)) {
            log.warn("Template data is not a Map, skipping: {}", template);
            return null;
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> templateMap = (Map<String, Object>) template;
            Object userDetailsObj = itemContext.get("item");

            Map<String, Object> userDetails = JsonUtil.convertValue(userDetailsObj, Map.class);
            if (userDetails == null) {
                log.warn("Could not convert user details to map from context item.");
                return null;
            }

            String mobileNumber = extractMobileNumber(userDetails);
            if (mobileNumber == null) {
                log.warn("No mobile number found for user: {}", userDetails);
                return null;
            }

            String templateName = (String) templateMap.get("templateName");
            if (templateName == null) {
                log.warn("No 'templateName' found in template: {}", template);
                return null;
            }

            WhatsappRequest request = new WhatsappRequest();
            request.setTemplateName(templateName);
            request.setLanguageCode("en"); // Default language

            Map<String, String> userInfo = new HashMap<>();

            // Add placeholders if they exist
            Object placeholdersObj = templateMap.get("placeholders");
            if (placeholdersObj instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> placeholders = (Map<String, Object>) placeholdersObj;
                placeholders.forEach((k, v) -> userInfo.put(k, String.valueOf(v)));
            }

            // Add all user details to be available for the template
            userDetails.forEach((k, v) -> userInfo.put(k, String.valueOf(v)));

            request.setUserDetails(Collections.singletonList(Map.of(mobileNumber, userInfo)));
            return request;

        } catch (Exception e) {
            log.error("Error creating WhatsApp request", e);
            return null;
        }
    }

    private Map<String, Object> convertWhatsappRequestToMap(WhatsappRequest request) {
        return objectMapper.convertValue(request, Map.class);
    }

    private String extractMobileNumber(Map<String, Object> item) {
        return Arrays
                .stream(new String[] { "mobileNumber", "mobile_number", "mobile", "phone", "phoneNumber",
                        "phone_number" })
                .map(item::get)
                .filter(Objects::nonNull)
                .map(String::valueOf)
                .filter(s -> !s.isBlank())
                .findFirst()
                .orElse(null);
    }

    /**
     * Processes a switch-case operation.
     */
    private Map<String, Object> processSwitchOperation(ForEachConfigDTO forEachConfig, Map<String, Object> loopContext,
            Object item) {
        Map<String, Object> result = new HashMap<>();

        String onExpr = forEachConfig.getOn();
        Map<String, Object> cases = forEachConfig.getCases();

        if (onExpr == null || onExpr.isBlank()) {
            log.warn("SWITCH operation missing 'on' expression");
            result.put("status", "missing_on_expression");
            return result;
        }

        // Evaluate the switch expression
        Object switchValue = spelEvaluator.evaluate(onExpr, loopContext);
        String key = String.valueOf(switchValue);

        // Find matching case
        Object selectedCase = cases != null ? cases.get(key) : null;
        if (selectedCase == null) {
            selectedCase = cases.get("default");
            log.debug("No case found for key: {}, using default", key);
        }

        if (selectedCase != null) {
            ((Map) item).put(forEachConfig.getEval(), selectedCase);
            result.put(forEachConfig.getEval(), selectedCase);
        }

        return result;
    }

    private Map<String, Object> processSpelEvaluatorOperation(String evalVarName, String computeExpr,
            Map<String, Object> loopContext, Object item) {
        Map<String, Object> result = new HashMap<>();

        if (evalVarName == null || evalVarName.isBlank()) {
            log.warn("SPEL_EVALUATOR operation missing 'eval' field name");
            result.put("status", "missing_eval_field");
            return result;
        }

        if (computeExpr == null || computeExpr.isBlank()) {
            log.warn("SPEL_EVALUATOR operation missing 'compute' expression");
            result.put("status", "missing_compute_expression");
            return result;
        }

        if (!(item instanceof Map)) {
            log.warn("SPEL_EVALUATOR operation requires item to be a Map to store the result");
            result.put("status", "item_not_map");
            return result;
        }

        try {
            // Evaluate the expression using the full stacked context
            Object resultValue = evaluateWithStackedContext(computeExpr, loopContext);

            // Store the result directly on the item map
            ((Map<String, Object>) item).put(evalVarName, resultValue);

            log.debug("SPEL_EVALUATOR computed '{}' and stored value: {}", evalVarName, resultValue);
            result.put("status", "success");
            result.put(evalVarName, resultValue);
        } catch (Exception e) {
            log.error("Error executing SPEL_EVALUATOR operation", e);
            result.put("status", "error");
            result.put("error", e.getMessage());
        }

        return result;
    }

    @Override
    public String getOperationType() {
        return "ITERATOR";
    }

    /**
     * Executes a nested HTTP_REQUEST operation.
     */
    private Map<String, Object> processHttpRequestOperation(ForEachConfigDTO forEachConfig,
            Map<String, Object> loopContext) {
        Object params = forEachConfig.getParams();
        if (params == null) {
            log.warn("HTTP_REQUEST operation missing 'params'.");
            return Map.of("status", "error", "error", "missing_params");
        }

        try {
            // The 'params' object *is* the config for the HttpRequestNodeHandler.
            // We serialize it back to JSON for the handler to consume.
            String httpConfigJson = objectMapper.writeValueAsString(params);

            // We pass the current loopContext, which contains #ctx and #item.
            // The HttpRequestNodeHandler will evaluate SpEL expressions within its config
            // using this context.
            Map<String, Object> httpResult = httpRequestNodeHandler.handle(
                    loopContext,
                    httpConfigJson,
                    Collections.emptyMap(), // nodeTemplates (not needed for this sub-operation)
                    0 // countProcessed
            );

            log.info("Executed nested HTTP_REQUEST for item with result keys: {}", httpResult.keySet());

            // The httpResult contains the changes (e.g., {"enrollmentHttpResponse_...":
            // {...}})
            // which will be added to the main context by the ActionNodeHandler.
            return httpResult;

        } catch (Exception e) {
            log.error("Error executing nested HTTP_REQUEST operation", e);
            return Map.of("status", "error", "error", e.getMessage());
        }
    }
}
