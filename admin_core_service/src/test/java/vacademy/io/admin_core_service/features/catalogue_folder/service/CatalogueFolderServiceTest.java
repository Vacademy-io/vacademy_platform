package vacademy.io.admin_core_service.features.catalogue_folder.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.catalogue_folder.dto.FolderLibraryDTOs.DeleteResponse;
import vacademy.io.admin_core_service.features.catalogue_folder.dto.FolderLibraryDTOs.MoveRequest;
import vacademy.io.admin_core_service.features.catalogue_folder.dto.FolderLibraryDTOs.NodeRequest;
import vacademy.io.admin_core_service.features.catalogue_folder.dto.FolderLibraryDTOs.NodeResponse;
import vacademy.io.admin_core_service.features.catalogue_folder.dto.FolderLibraryDTOs.TreeResponse;
import vacademy.io.admin_core_service.features.catalogue_folder.entity.CatalogueFolderLibrary;
import vacademy.io.admin_core_service.features.catalogue_folder.entity.CatalogueFolderNode;
import vacademy.io.admin_core_service.features.catalogue_folder.repository.CatalogueFolderLibraryRepository;
import vacademy.io.admin_core_service.features.catalogue_folder.repository.CatalogueFolderNodeRepository;
import vacademy.io.admin_core_service.features.product_page.entity.ProductPage;
import vacademy.io.admin_core_service.features.product_page.repository.ProductPageRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Tree rules of the folder library, run against an in-memory node table:
 * a folder can never move into its own subtree, orders stay dense after a
 * move, deletes take the subtree, and the public tree shows only what a
 * visitor may see (no hidden branches, no inactive or foreign product pages).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CatalogueFolderServiceTest {

    private static final String INSTITUTE = "inst-1";
    private static final String LIBRARY = "lib-1";

    @Mock private CatalogueFolderLibraryRepository libraryRepository;
    @Mock private CatalogueFolderNodeRepository nodeRepository;
    @Mock private ProductPageRepository productPageRepository;
    @Mock private InstituteAccessValidator accessValidator;
    @Mock private CustomUserDetails user;

    @InjectMocks private CatalogueFolderService service;

    private final Map<String, CatalogueFolderNode> table = new LinkedHashMap<>();
    private final Map<String, ProductPage> pages = new LinkedHashMap<>();

    @BeforeEach
    void setUp() {
        CatalogueFolderLibrary lib = CatalogueFolderLibrary.builder()
                .id(LIBRARY).instituteId(INSTITUTE).name("Courses").status("ACTIVE").build();
        when(user.getUserId()).thenReturn("u-1");
        when(libraryRepository.findByIdAndInstituteIdAndStatus(LIBRARY, INSTITUTE, "ACTIVE"))
                .thenReturn(Optional.of(lib));
        when(libraryRepository.lockForUpdate(LIBRARY, INSTITUTE, "ACTIVE")).thenReturn(Optional.of(lib));
        when(libraryRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        when(nodeRepository.findByLibraryIdAndInstituteIdOrderByDisplayOrderAsc(LIBRARY, INSTITUTE))
                .thenAnswer(i -> {
                    List<CatalogueFolderNode> out = new ArrayList<>(table.values());
                    out.sort(Comparator.comparingInt(CatalogueFolderNode::getDisplayOrder));
                    return out;
                });
        when(nodeRepository.findLibraryIdOf(anyString(), anyString()))
                .thenAnswer(i -> Optional.ofNullable(table.get((String) i.getArgument(0)))
                        .filter(n -> n.getInstituteId().equals(i.getArgument(1)))
                        .map(CatalogueFolderNode::getLibraryId));
        when(nodeRepository.save(any())).thenAnswer(i -> {
            CatalogueFolderNode n = i.getArgument(0);
            if (n.getId() == null) n.setId(UUID.randomUUID().toString());
            table.put(n.getId(), n);
            return n;
        });
        when(nodeRepository.saveAll(any())).thenAnswer(i -> {
            for (CatalogueFolderNode n : (Iterable<CatalogueFolderNode>) i.getArgument(0)) table.put(n.getId(), n);
            return i.getArgument(0);
        });
        org.mockito.Mockito.doAnswer(i -> {
            for (Object id : (Collection<?>) i.getArgument(0)) table.remove(id);
            return null;
        }).when(nodeRepository).deleteAllById(any());

        when(productPageRepository.findAllById(any())).thenAnswer(i -> {
            List<ProductPage> out = new ArrayList<>();
            for (Object id : (Iterable<?>) i.getArgument(0)) {
                if (pages.containsKey(id)) out.add(pages.get(id));
            }
            return out;
        });
        when(productPageRepository.findById(anyString()))
                .thenAnswer(i -> Optional.ofNullable(pages.get((String) i.getArgument(0))));
    }

    private CatalogueFolderNode node(String id, String parent, String type, int order) {
        CatalogueFolderNode n = CatalogueFolderNode.builder()
                .id(id).libraryId(LIBRARY).instituteId(INSTITUTE).parentId(parent)
                .nodeType(type).title(id).displayOrder(order).status("ACTIVE").build();
        table.put(id, n);
        return n;
    }

    private ProductPage page(String id, String institute, String status) {
        ProductPage p = new ProductPage();
        p.setId(id);
        p.setCode("code-" + id);
        p.setName("Page " + id);
        p.setInstituteId(institute);
        p.setStatus(status);
        pages.put(id, p);
        return p;
    }

    private static List<String> ids(List<NodeResponse> nodes) {
        return nodes.stream().map(NodeResponse::getId).toList();
    }

    @Test
    @DisplayName("a folder cannot be moved into its own subtree")
    void moveIntoOwnDescendantIsRejected() {
        node("class10", null, "FOLDER", 0);
        node("science", "class10", "FOLDER", 0);
        node("physics", "science", "FOLDER", 0);

        VacademyException e = assertThrows(VacademyException.class,
                () -> service.moveNode(user, INSTITUTE, "class10", new MoveRequest("physics", 0)));
        assertTrue(e.getMessage().contains("inside itself"));
        assertEquals("science", table.get("physics").getParentId());
    }

    @Test
    @DisplayName("moving renumbers the destination and the source densely")
    void moveRenumbersBothParents() {
        node("a", null, "FOLDER", 0);
        node("b", null, "FOLDER", 1);
        node("c", null, "FOLDER", 2);
        node("x", "a", "FOLDER", 0);

        TreeResponse tree = service.moveNode(user, INSTITUTE, "c", new MoveRequest("a", 0));

        assertEquals(List.of("a", "b"), ids(tree.getRoots()));
        assertEquals(List.of("c", "x"), ids(tree.getRoots().get(0).getChildren()));
        assertEquals(1, table.get("b").getDisplayOrder());
        assertEquals(0, table.get("c").getDisplayOrder());
        assertEquals(1, table.get("x").getDisplayOrder());
    }

    @Test
    @DisplayName("reordering within one folder keeps every sibling")
    void reorderWithinParent() {
        node("a", null, "FOLDER", 0);
        node("b", null, "FOLDER", 1);
        node("c", null, "FOLDER", 2);

        TreeResponse tree = service.moveNode(user, INSTITUTE, "a", new MoveRequest(null, 2));

        assertEquals(List.of("b", "c", "a"), ids(tree.getRoots()));
    }

    @Test
    @DisplayName("deleting a folder deletes everything under it")
    void deleteRemovesSubtree() {
        node("a", null, "FOLDER", 0);
        node("b", null, "FOLDER", 1);
        node("a1", "a", "FOLDER", 0);
        node("a1x", "a1", "PRODUCT_PAGE", 0).setProductPageId("p1");
        page("p1", INSTITUTE, "ACTIVE");

        DeleteResponse res = service.deleteNode(user, INSTITUTE, "a");

        assertEquals(3, res.getDeleted());
        assertEquals(List.of("b"), ids(res.getTree().getRoots()));
        assertEquals(0, table.get("b").getDisplayOrder());
    }

    @Test
    @DisplayName("the public tree hides hidden branches and pages a visitor cannot buy")
    void publicTreeFiltersWhatVisitorsSee() {
        node("open", null, "FOLDER", 0);
        node("hidden", null, "FOLDER", 1).setStatus("HIDDEN");
        node("underHidden", "hidden", "PRODUCT_PAGE", 0).setProductPageId("live");
        node("live", "open", "PRODUCT_PAGE", 0).setProductPageId("live");
        node("draft", "open", "PRODUCT_PAGE", 1).setProductPageId("draft");
        node("foreign", "open", "PRODUCT_PAGE", 2).setProductPageId("foreign");
        page("live", INSTITUTE, "ACTIVE");
        page("draft", INSTITUTE, "DRAFT");
        page("foreign", "other-institute", "ACTIVE");

        TreeResponse tree = service.publicTree(INSTITUTE, LIBRARY).orElseThrow();

        assertEquals(List.of("open"), ids(tree.getRoots()));
        List<NodeResponse> leaves = tree.getRoots().get(0).getChildren();
        assertEquals(List.of("live"), ids(leaves));
        assertEquals("code-live", leaves.get(0).getProductPageCode());
        // Learners address product pages by code; the id stays admin-only.
        assertEquals(null, leaves.get(0).getProductPageId());
    }

    @Test
    @DisplayName("another institute's product page cannot be linked")
    void foreignProductPageIsRejected() {
        node("a", null, "FOLDER", 0);
        page("foreign", "other-institute", "ACTIVE");
        NodeRequest req = new NodeRequest("a", "PRODUCT_PAGE", null, null, null, "foreign", null, null);

        assertThrows(VacademyException.class, () -> service.createNode(user, INSTITUTE, LIBRARY, req));
        assertEquals(1, table.size());
    }

    @Test
    @DisplayName("nothing can be added inside a product page")
    void cannotNestUnderProductPage() {
        node("leaf", null, "PRODUCT_PAGE", 0).setProductPageId("p1");
        page("p1", INSTITUTE, "ACTIVE");
        NodeRequest req = new NodeRequest("leaf", "FOLDER", "Inner", null, null, null, null, null);

        assertThrows(VacademyException.class, () -> service.createNode(user, INSTITUTE, LIBRARY, req));
    }

    @Test
    @DisplayName("an item whose product page was deleted can still be renamed")
    void renameWithDeletedProductPage() {
        node("a", null, "FOLDER", 0);
        node("leaf", "a", "PRODUCT_PAGE", 0).setProductPageId("gone");
        NodeRequest req = new NodeRequest(null, null, "Old bundle", null, null, "gone", "HIDDEN", null);

        service.updateNode(user, INSTITUTE, "leaf", req);

        assertEquals("Old bundle", table.get("leaf").getTitle());
        assertEquals("HIDDEN", table.get("leaf").getStatus());
    }

    @Test
    @DisplayName("an item of another institute is not found")
    void otherInstituteNodeIsNotFound() {
        node("a", null, "FOLDER", 0);
        NodeRequest req = new NodeRequest(null, null, "Hijacked", null, null, null, null, null);

        assertThrows(VacademyException.class, () -> service.updateNode(user, "inst-2", "a", req));
        assertEquals("a", table.get("a").getTitle());
    }

    @Test
    @DisplayName("image addresses must be web URLs")
    void imageMustBeWebUrl() {
        NodeRequest req = new NodeRequest(null, "FOLDER", "Class 10", null, "javascript:alert(1)", null, null, null);

        assertThrows(VacademyException.class, () -> service.createNode(user, INSTITUTE, LIBRARY, req));
    }

    @Test
    @DisplayName("a new folder is appended after its siblings")
    void createAppends() {
        node("a", null, "FOLDER", 0);
        node("b", null, "FOLDER", 1);
        NodeRequest req = new NodeRequest(null, "FOLDER", "Class 12", "Boards", "https://x.vacademy.io/i.png",
                null, null, Map.of("layout", "list"));

        TreeResponse tree = service.createNode(user, INSTITUTE, LIBRARY, req);

        NodeResponse created = tree.getRoots().get(2);
        assertEquals("Class 12", created.getTitle());
        assertEquals("list", created.getView().get("layout"));
        assertEquals(2, created.getDisplayOrder());
    }
}
