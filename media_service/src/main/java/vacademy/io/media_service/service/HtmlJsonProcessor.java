package vacademy.io.media_service.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Comment;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.select.Elements;
import org.jsoup.select.NodeVisitor;

import java.util.*;

import static vacademy.io.media_service.service.HtmlSpanCleaner.removeNewlinesInsideSpans;

public class HtmlJsonProcessor {
    private final Map<String, String> tagStorage = new HashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();


    // Modified restoration for JSON structure
    public String restoreTagsInJson(String jsonResponse) throws Exception {
        JsonNode rootNode = objectMapper.readTree(jsonResponse);
        JsonNode processedNode = processJsonNode(rootNode);
        return objectMapper.writeValueAsString(processedNode);
    }

    public JsonNode processJsonNode(JsonNode node) {
        if (node.isObject()) {
            ObjectNode objNode = (ObjectNode) node;
            Iterator<Map.Entry<String, JsonNode>> fields = objNode.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                objNode.set(field.getKey(), processJsonNode(field.getValue()));
            }
            return objNode;
        } else if (node.isArray()) {
            ArrayNode arrNode = (ArrayNode) node;
            for (int i = 0; i < arrNode.size(); i++) {
                arrNode.set(i, processJsonNode(arrNode.get(i)));
            }
            return arrNode;
        } else if (node.isTextual()) {
            String text = node.textValue();
            if (mightContainHtml(text)) {
                return new TextNode(restoreTagsInHtmlString(text));
            }
            return node;
        }
        return node;
    }

    public String removeTags(String html) {
        tagStorage.clear();
        Document doc = Jsoup.parse(html);

        // Process inner tags first to handle nested elements
        String[] tagsToRemove = {"mjx-container", "img", "svg"};

        for (String tag : tagsToRemove) {
            Elements elements = doc.select(tag);
            for (Element el : elements) {
                String uuid = UUID.randomUUID().toString().substring(0, 4);
                String originalHtml = el.outerHtml();
                tagStorage.put(uuid, originalHtml);
                // Use standardized comment format without extra spaces
                el.replaceWith(new Comment("DS_TAG:" + uuid));
            }
        }
        return doc.body().html();
    }

    private boolean mightContainHtml(String text) {
        // Simplified check with standardized comment format
        return text.contains("<!--DS_TAG:");
    }

    public String restoreTagsInHtmlString(String html) {
        if (html == null || html.isEmpty()) return html;

        html = removeNewlinesInsideSpans(html);
        Document doc = Jsoup.parseBodyFragment(html);
        List<Comment> comments = new ArrayList<>();

        doc.traverse(new NodeVisitor() {
            @Override
            public void head(Node node, int depth) {
                if (node instanceof Comment) {
                    comments.add((Comment) node);
                }
            }

            @Override
            public void tail(Node node, int depth) {}
        });

        for (Comment commentNode : comments) {
            String commentData = commentNode.getData().trim();
            if (commentData.startsWith("DS_TAG:")) {
                String uuid = commentData.substring(7).trim();
                String originalHtml = tagStorage.get(uuid);
                originalHtml = unescapeString(originalHtml);
                if (originalHtml == null) {
                    // Handle missing entry (e.g., log warning)
                    continue;
                }

                // Configure output to preserve original HTML syntax
                Document restoredDoc = Jsoup.parseBodyFragment(originalHtml);
                restoredDoc.outputSettings().syntax(Document.OutputSettings.Syntax.xml);
                Elements restoredElements = restoredDoc.body().children();

                if (!restoredElements.isEmpty()) {
                    Node parent = commentNode.parent();
                    int index = commentNode.siblingIndex();
                    commentNode.remove();

                    if (parent instanceof Element) {
                        Element parentElement = (Element) parent;
                        for (int i = restoredElements.size() - 1; i >= 0; i--) {
                            parentElement.insertChildren(index, restoredElements.get(i));
                        }
                    }
                }
            }
        }

        // Preserve original HTML syntax in output
        doc.outputSettings().syntax(Document.OutputSettings.Syntax.xml);
        return doc.body().html();
    }

    /**
     * Cleans a string by:
     * 1. Removing backslashes that escape quotes
     * 2. Converting Unicode escape sequences like \u003c to corresponding characters
     * 3. Handling common escape sequences like \n, \t, etc.
     *
     * @param input The string with escape sequences
     * @return The cleaned string with actual characters
     */
    public static String unescapeString(String input) {
        if (input == null) {
            return null;
        }

        StringBuilder result = new StringBuilder(input.length());
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);

            // Handle backslash escape sequences
            if (c == '\\' && i + 1 < input.length()) {
                char next = input.charAt(i + 1);

                switch (next) {
                    case '"':
                        result.append('"');
                        i++;
                        break;
                    case '\\':
                        result.append('\\');
                        i++;
                        break;
                    case 'n':
                        result.append('\n');
                        i++;
                        break;
                    case 't':
                        result.append('\t');
                        i++;
                        break;
                    case 'r':
                        result.append('\r');
                        i++;
                        break;
                    case 'u':

                        if (i + 5 < input.length()) {
                            try {
                                String hex = input.substring(i + 2, i + 6);
                                int codePoint = Integer.parseInt(hex, 16);
                                result.append((char) codePoint);
                                i += 5; // Skip the 'u' and 4 hex digits
                            } catch (NumberFormatException e) {
                                // If invalid hex, keep the original sequence
                                result.append(c);
                            }
                        } else {
                            // Not enough characters for a complete Unicode escape
                            result.append(c);
                        }
                        break;
                    default:
                        // For any unrecognized escape, just keep the backslash and the character
                        result.append(c);
                        break;
                }
            } else {
                // Regular character, just append it
                result.append(c);
            }
        }

        return result.toString();
    }

}