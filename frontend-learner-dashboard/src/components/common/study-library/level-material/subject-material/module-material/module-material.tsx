import { useNavHeadingStore } from "@/stores/layout-container/useNavHeadingStore";
import { useRouter } from "@tanstack/react-router";
import { CaretLeft } from "phosphor-react";
import { useEffect } from "react";
import { Modules } from "./modules";
import { useModulesWithChaptersStore } from "@/stores/study-library/use-modules-with-chapters-store";
import { getSubjectName } from "@/utils/study-library/get-name-by-id/getSubjectNameById";
import { fetchModulesWithChapters } from "@/services/study-library/getModulesWithChapters";
import { PullToRefreshWrapper } from "@/components/design-system/pull-to-refresh";
import { getPackageSessionId } from "@/utils/study-library/get-list-from-stores/getPackageSessionId";

export const ModuleMaterial = () => {
  const { setNavHeading } = useNavHeadingStore();
  const router = useRouter();
  const searchParams = router.state.location.search;
  const subjectId: string = searchParams.subjectId || "";

  const { modulesWithChaptersData, setModulesWithChaptersData } =
    useModulesWithChaptersStore();

  const handleBackClick = () => {
    router.navigate({
      to: `/study-library/courses/levels/subjects`,
    });
  };

  const subjectName = getSubjectName(subjectId);

  const heading = (
    <div className="flex items-center gap-2">
      <CaretLeft onClick={handleBackClick} className="cursor-pointer size-5" />
      <div>{subjectName}</div>
    </div>
  );

  useEffect(() => {
    setNavHeading(heading);
  }, []);

  const refreshModules = async () => {
    const PackageSessionId = await getPackageSessionId();

    const data = await fetchModulesWithChapters(subjectId, PackageSessionId);
    setModulesWithChaptersData(data);
  };

  return (
    <PullToRefreshWrapper onRefresh={refreshModules}>
      <Modules modules={modulesWithChaptersData} />
    </PullToRefreshWrapper>
  );
};
