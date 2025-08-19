package vacademy.io.admin_core_service.features.workflow.spel;

import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.SpelEvaluationException;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.workflow.engine.TransformNodeHandler;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class SpelEvaluator {

    private final ExpressionParser parser = new SpelExpressionParser();

    public Object eval(String expressionString, Map<String, Object> contextVars) {
        if (expressionString == null || expressionString.isBlank()) {
            return null;
        }

        String exprStr = expressionString.trim();
        if (exprStr.startsWith("#{") && exprStr.endsWith("}")) {
            exprStr = exprStr.substring(2, exprStr.length() - 1);
        }

        exprStr = '#' + exprStr;

        ExpressionParser parser = new SpelExpressionParser();
        StandardEvaluationContext context = new StandardEvaluationContext();
        // to remove from here for better performance
        context.setVariable("ctx", contextVars);
        context.setVariable("transformNodeHandler", contextVars.get("transformNodeHandler"));
        try {
            Expression expr = parser.parseExpression(exprStr);
            return expr.getValue(context);
        } catch (SpelEvaluationException e) {
            e.printStackTrace();
            return null;
        }
    }

}