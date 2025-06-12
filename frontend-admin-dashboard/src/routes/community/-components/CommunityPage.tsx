// import { PublishTab } from "./PublishTab";
import { CommunityPageHeader } from "./CommunityPageHeader";
import { FiltersTab } from "./FiltersTab";
import { FilteredDataList } from "./FilteredDataList";
import { fetchStaticData } from "../-services/utils";
import { useEffect } from "react";
import { useFilterStore } from "../-store/useFilterOptions";

export function CommunityPage() {
    const { setOptions } = useFilterStore();
    const fetch = async () => {
        const data = await fetchStaticData();
        setOptions(data);
    };
    useEffect(() => {
        fetch();
    }, []);

    return (
        <div className="mb-10 flex w-full flex-col">
            {/* TODO : this feature is for later
            <PublishTab /> */}
            <CommunityPageHeader />
            <FiltersTab />
            <FilteredDataList />
        </div>
    );
}
