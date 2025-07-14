package vacademy.io.media_service.course.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class MerkelHashService {
    private final ObjectMapper objectMapper = new ObjectMapper();

    public String generateMerkleHash(Object courseTree) {
        try {
            // Serialize whole tree
            String json = objectMapper.writeValueAsString(courseTree);
            return sha256(json);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Error serializing tree for Merkle hash", e);
        }
    }

    public String sha256(String data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not supported", e);
        }
    }

    public void injectMerkleHashInAddModifications(List<Map<String, Object>> modifications, String globalHash, Map<String, String> pathHashes) {
        for (Map<String, Object> mod : modifications) {
            if ("ADD".equals(mod.get("action"))) {
                Map<String, Object> node = (Map<String, Object>) mod.get("node");
                if (node != null) {
                    String path = (String) node.get("path");
                    node.put("merkleHash", pathHashes.getOrDefault(path, globalHash));
                }
            }
        }
    }

    public Map<String, String> generatePathWiseHashes(JsonNode courseRootJson) {
        Map<String, String> pathHashMap = new HashMap<>();

        // Start from the "tree" node inside the course root
        JsonNode treeNode = courseRootJson.get("tree");

        if (treeNode != null && treeNode.isArray()) {
            for (JsonNode subjectNode : treeNode) {
                traverse(subjectNode, pathHashMap);
            }
        } else {
            log.warn("Tree node not found or is not an array.");
        }

        return pathHashMap;
    }

    private void traverse(JsonNode node, Map<String, String> map) {
        if (node.has("path") && !node.get("path").isNull()) {
            String path = node.get("path").asText();
            String hash = sha256(node.toString());
            map.put(path, hash);
            log.info("✔️ Hashed path: {} -> {}", path, hash);
        }

        // Recursively traverse children fields
        for (String field : List.of("tree", "modules", "chapters", "slides")) {
            if (node.has(field) && node.get(field).isArray()) {
                for (JsonNode child : node.get(field)) {
                    traverse(child, map);
                }
            }
        }
    }
}
