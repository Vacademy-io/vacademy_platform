package vacademy.io.admin_core_service.features.telephony.ivr;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.telephony.controller.dto.IvrMenuDTO;
import vacademy.io.admin_core_service.features.telephony.controller.dto.IvrNodeDTO;
import vacademy.io.admin_core_service.features.telephony.enums.IvrNodeType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.IvrMenu;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.IvrNode;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.IvrMenuRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.IvrNodeRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * CRUD + runtime resolution for IVR menus. The admin builder posts a whole tree
 * (menu + nodes) which is replaced atomically; the inbound call flow resolves the
 * menu for a dialled DID and walks nodes by id.
 */
@Service
@RequiredArgsConstructor
public class IvrMenuService {

    private static final Logger log = LoggerFactory.getLogger(IvrMenuService.class);

    private final IvrMenuRepository menuRepo;
    private final IvrNodeRepository nodeRepo;
    private final ObjectMapper mapper = new ObjectMapper();

    // ── Runtime (inbound call flow) ──────────────────────────────────────────

    /** DID-specific enabled menu if one exists, else the institute's default menu. */
    public Optional<IvrMenu> resolveMenu(String instituteId, String dialedNumber) {
        if (instituteId == null) return Optional.empty();
        if (dialedNumber != null && !dialedNumber.isBlank()) {
            Optional<IvrMenu> byDid = menuRepo
                    .findFirstByInstituteIdAndDialedNumberAndEnabledTrue(instituteId, dialedNumber.trim());
            if (byDid.isPresent()) return byDid;
        }
        return menuRepo.findFirstByInstituteIdAndDialedNumberIsNullAndEnabledTrue(instituteId);
    }

    /**
     * Resolve the menu for an inbound call, honouring a number's own
     * {@code inbound_ivr_menu_id} first (managed per number on the Numbers card),
     * then the DID-specific/default menu.
     */
    public Optional<IvrMenu> resolveMenu(String instituteId, String dialedNumber, String preferredMenuId) {
        if (preferredMenuId != null && !preferredMenuId.isBlank()) {
            Optional<IvrMenu> pref = menuRepo.findById(preferredMenuId.trim())
                    .filter(m -> instituteId != null && instituteId.equals(m.getInstituteId())
                            && Boolean.TRUE.equals(m.getEnabled()));
            if (pref.isPresent()) return pref;
        }
        return resolveMenu(instituteId, dialedNumber);
    }

    /** Parse a DIAL node's counsellor user ids (empty on null/garbage). */
    public List<String> dialUserIds(IvrNode node) {
        if (node == null || node.getDialUserIds() == null || node.getDialUserIds().isBlank()) return List.of();
        try {
            List<String> u = mapper.readValue(node.getDialUserIds(), new TypeReference<>() {});
            return u == null ? List.of() : u;
        } catch (Exception e) {
            log.warn("ivr: bad dial_user_ids on node {}", node.getId(), e);
            return List.of();
        }
    }

    public Optional<IvrNode> getNode(String nodeId) {
        if (nodeId == null || nodeId.isBlank()) return Optional.empty();
        return nodeRepo.findById(nodeId);
    }

    /** Parse a GATHER node's digit→nodeId map (empty on null/garbage). */
    public Map<String, String> digitMap(IvrNode node) {
        if (node == null || node.getDigitMap() == null || node.getDigitMap().isBlank()) return Map.of();
        try {
            Map<String, String> m = mapper.readValue(node.getDigitMap(), new TypeReference<>() {});
            return m == null ? Map.of() : m;
        } catch (Exception e) {
            log.warn("ivr: bad digit_map on node {}", node.getId(), e);
            return Map.of();
        }
    }

    /** Parse a DIAL node's target numbers (empty on null/garbage). */
    public List<String> dialTargets(IvrNode node) {
        if (node == null || node.getDialTargets() == null || node.getDialTargets().isBlank()) return List.of();
        try {
            List<String> t = mapper.readValue(node.getDialTargets(), new TypeReference<>() {});
            return t == null ? List.of() : t;
        } catch (Exception e) {
            log.warn("ivr: bad dial_targets on node {}", node.getId(), e);
            return List.of();
        }
    }

    // ── CRUD (admin builder) ─────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<IvrMenuDTO> listMenus(String instituteId) {
        return menuRepo.findByInstituteIdOrderByCreatedAtDesc(instituteId).stream()
                .map(m -> toDto(m, nodeRepo.findByMenuId(m.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public IvrMenuDTO getMenu(String menuId) {
        IvrMenu menu = menuRepo.findById(menuId)
                .orElseThrow(() -> new VacademyException("IVR menu not found"));
        return toDto(menu, nodeRepo.findByMenuId(menuId));
    }

    @Transactional
    public IvrMenuDTO saveMenu(IvrMenuDTO dto) {
        if (dto == null || dto.getInstituteId() == null || dto.getInstituteId().isBlank()) {
            throw new VacademyException("instituteId is required");
        }
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw new VacademyException("Menu name is required");
        }
        validateTree(dto);

        String menuId = (dto.getId() != null && !dto.getId().isBlank())
                ? dto.getId() : UUID.randomUUID().toString();

        IvrMenu menu = menuRepo.findById(menuId).orElseGet(IvrMenu::new);
        menu.setId(menuId);
        menu.setInstituteId(dto.getInstituteId());
        menu.setName(dto.getName().trim());
        menu.setDialedNumber(blankToNull(dto.getDialedNumber()));
        menu.setRootNodeId(blankToNull(dto.getRootNodeId()));
        menu.setEnabled(dto.getEnabled() == null ? Boolean.TRUE : dto.getEnabled());
        menuRepo.save(menu);

        // Atomic full-tree replace (bulk delete executes immediately).
        nodeRepo.deleteByMenuId(menuId);
        List<IvrNode> nodes = new ArrayList<>();
        for (IvrNodeDTO n : safe(dto.getNodes())) {
            nodes.add(IvrNode.builder()
                    .id(n.getId())
                    .menuId(menuId)
                    .nodeType(IvrNodeType.parseOrNull(n.getNodeType()).name())
                    .label(n.getLabel())
                    .promptText(n.getPromptText())
                    .promptAudioId(n.getPromptAudioId())
                    .digitMap(writeJson(n.getDigitMap()))
                    .dialTargets(writeJson(n.getDialTargets()))
                    .dialUserIds(writeJson(n.getDialUserIds()))
                    .nextNodeId(blankToNull(n.getNextNodeId()))
                    .aiAgentId(blankToNull(n.getAiAgentId()))
                    .timeoutSeconds(n.getTimeoutSeconds() == null ? 6 : n.getTimeoutSeconds())
                    .maxRetries(n.getMaxRetries() == null ? 2 : n.getMaxRetries())
                    .build());
        }
        nodeRepo.saveAll(nodes);
        return toDto(menu, nodes);
    }

    @Transactional
    public void deleteMenu(String menuId) {
        nodeRepo.deleteByMenuId(menuId);
        menuRepo.deleteById(menuId);
    }

    // ── Validation + mapping ────────────────────────────────────────────────

    private void validateTree(IvrMenuDTO dto) {
        List<IvrNodeDTO> nodes = safe(dto.getNodes());
        java.util.Set<String> ids = new java.util.HashSet<>();
        for (IvrNodeDTO n : nodes) {
            if (n.getId() == null || n.getId().isBlank()) {
                throw new VacademyException("Every IVR node needs a stable id");
            }
            if (!ids.add(n.getId())) {
                throw new VacademyException("Duplicate IVR node id: " + n.getId());
            }
            if (IvrNodeType.parseOrNull(n.getNodeType()) == null) {
                throw new VacademyException("Unknown IVR node type: " + n.getNodeType());
            }
            if (IvrNodeType.parseOrNull(n.getNodeType()) == IvrNodeType.AI_AGENT
                    && (n.getAiAgentId() == null || n.getAiAgentId().isBlank())) {
                throw new VacademyException("AI agent node needs an agent selected");
            }
        }
        // Referenced ids (root, digit targets, next) must exist in the tree.
        if (dto.getRootNodeId() != null && !dto.getRootNodeId().isBlank()
                && !ids.contains(dto.getRootNodeId())) {
            throw new VacademyException("rootNodeId does not match any node");
        }
        for (IvrNodeDTO n : nodes) {
            if (n.getNextNodeId() != null && !n.getNextNodeId().isBlank() && !ids.contains(n.getNextNodeId())) {
                throw new VacademyException("nextNodeId " + n.getNextNodeId() + " has no matching node");
            }
            if (n.getDigitMap() != null) {
                for (String target : n.getDigitMap().values()) {
                    if (target != null && !target.isBlank() && !ids.contains(target)) {
                        throw new VacademyException("digitMap target " + target + " has no matching node");
                    }
                }
            }
        }
    }

    private IvrMenuDTO toDto(IvrMenu menu, List<IvrNode> nodes) {
        List<IvrNodeDTO> nodeDtos = new ArrayList<>();
        for (IvrNode n : nodes) {
            nodeDtos.add(IvrNodeDTO.builder()
                    .id(n.getId())
                    .nodeType(n.getNodeType())
                    .label(n.getLabel())
                    .promptText(n.getPromptText())
                    .promptAudioId(n.getPromptAudioId())
                    .digitMap(readMap(n.getDigitMap()))
                    .dialTargets(readList(n.getDialTargets()))
                    .dialUserIds(readList(n.getDialUserIds()))
                    .nextNodeId(n.getNextNodeId())
                    .aiAgentId(n.getAiAgentId())
                    .timeoutSeconds(n.getTimeoutSeconds())
                    .maxRetries(n.getMaxRetries())
                    .build());
        }
        return IvrMenuDTO.builder()
                .id(menu.getId())
                .instituteId(menu.getInstituteId())
                .name(menu.getName())
                .dialedNumber(menu.getDialedNumber())
                .rootNodeId(menu.getRootNodeId())
                .enabled(menu.getEnabled())
                .nodes(nodeDtos)
                .build();
    }

    private String writeJson(Object value) {
        if (value == null) return null;
        try { return mapper.writeValueAsString(value); }
        catch (Exception e) { return null; }
    }

    private Map<String, String> readMap(String json) {
        if (json == null || json.isBlank()) return null;
        try { return mapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return null; }
    }

    private List<String> readList(String json) {
        if (json == null || json.isBlank()) return null;
        try { return mapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception e) { return null; }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static <T> List<T> safe(List<T> l) {
        return l == null ? List.of() : l;
    }
}
