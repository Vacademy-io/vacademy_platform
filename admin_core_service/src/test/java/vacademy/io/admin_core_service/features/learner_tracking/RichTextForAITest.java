package vacademy.io.admin_core_service.features.learner_tracking;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.learner_tracking.util.RichTextForAI;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The LLM payload used to ship question and option content as raw authored HTML.
 * These pin that what reaches the model is the words (and the LaTeX source of any
 * maths), not the markup that wraps them.
 */
class RichTextForAITest {

    @Test
    @DisplayName("plain text passes through, whitespace collapsed")
    void plainText() {
        assertEquals("What is 2 + 2?", RichTextForAI.toPlainText("What is 2 + 2?"));
        assertEquals("spaced out", RichTextForAI.toPlainText("  spaced\n\n  out  "));
        assertEquals("", RichTextForAI.toPlainText(null));
    }

    @Test
    @DisplayName("tags go, text stays, block boundaries keep words apart")
    void stripsTags() {
        assertEquals("Choose the odd one out",
                RichTextForAI.toPlainText("<p>Choose the <strong>odd</strong> one out</p>"));
        assertEquals("First Second", RichTextForAI.toPlainText("<p>First</p><p>Second</p>"));
        assertEquals("Line one Line two", RichTextForAI.toPlainText("Line one<br/>Line two"));
    }

    @Test
    @DisplayName("HTML entities are decoded")
    void decodesEntities() {
        assertEquals("a < b & c > d", RichTextForAI.toPlainText("a &lt; b &amp; c &gt; d"));
        assertEquals("no break space", RichTextForAI.toPlainText("no&nbsp;break&nbsp;space"));
    }

    @Test
    @DisplayName("KaTeX keeps its LaTeX source instead of its rendered debris")
    void keepsLatex() {
        String katex = "<p>Solve <span class=\"math-inline\" data-latex=\"x^{2}+2x+1\">"
                + "<span class=\"katex\"><span class=\"katex-html\">x2+2x+1</span></span></span> for x</p>";
        String result = RichTextForAI.toPlainText(katex);
        assertTrue(result.contains("x^{2}+2x+1"), result);
        assertFalse(result.contains("<"), result);
        assertFalse(result.contains("katex"), result);
    }
}
