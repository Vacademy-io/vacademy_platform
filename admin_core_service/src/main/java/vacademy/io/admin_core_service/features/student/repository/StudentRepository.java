package vacademy.io.admin_core_service.features.student.repository;


import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.CrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.student.entity.Student;
import vacademy.io.common.institute.entity.Institute;

import java.util.List;

@Repository
public interface StudentRepository extends CrudRepository<Student, String> {
}
