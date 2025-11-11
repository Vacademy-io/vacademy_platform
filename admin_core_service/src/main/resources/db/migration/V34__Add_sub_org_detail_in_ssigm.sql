ALTER TABLE student_session_institute_group_mapping
ADD COLUMN comma_separated_org_roles TEXT,
ADD COLUMN sub_org_id VARCHAR(255);

ALTER TABLE enroll_invite
ADD COLUMN setting_json TEXT;

ALTER TABLE student_session_institute_group_mapping
ADD CONSTRAINT fk_student_session_sub_org
FOREIGN KEY (sub_org_id) REFERENCES institutes(id)
ON DELETE SET NULL ON UPDATE CASCADE;
