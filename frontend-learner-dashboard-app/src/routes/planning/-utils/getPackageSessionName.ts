export const getPackageSessionName = (batch: any): string => {
  const courseName = batch.package_dto.package_name;
  const sessionName = batch.session.session_name;
  const levelName = batch.level.level_name;
  return `${courseName} - ${sessionName} (${levelName})`;
};
