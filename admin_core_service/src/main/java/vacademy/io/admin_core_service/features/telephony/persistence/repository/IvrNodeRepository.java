package vacademy.io.admin_core_service.features.telephony.persistence.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.IvrNode;

import java.util.List;

@Repository
public interface IvrNodeRepository extends JpaRepository<IvrNode, String> {

    List<IvrNode> findByMenuId(String menuId);

    /** Bulk delete (executes immediately) so a full-tree re-save can re-insert the
     *  same client-provided node ids in the same transaction without a PK clash. */
    @Modifying
    @Query("delete from IvrNode n where n.menuId = :menuId")
    void deleteByMenuId(@Param("menuId") String menuId);
}
