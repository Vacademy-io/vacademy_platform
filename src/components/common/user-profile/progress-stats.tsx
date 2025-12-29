import { useState, useEffect } from "react";
import { CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { USER_LINKED_DATA } from "@/constants/urls";
import authenticatedAxiosInstance from "@/lib/auth/axiosInstance";
import { MyButton } from "@/components/design-system/button";

interface LinkedData {
  id: string;
  userId: string;
  type: "strength" | "weakness";
  data: string;
  percentage: number;
  createdAt: string;
  updatedAt: string;
}

const ProgressStats = ({ userId }: { userId: string }) => {
  const [strengths, setStrengths] = useState<LinkedData[]>([]);
  const [weaknesses, setWeaknesses] = useState<LinkedData[]>([]);
  const [showAllStrengths, setShowAllStrengths] = useState(false);
  const [showAllWeaknesses, setShowAllWeaknesses] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await authenticatedAxiosInstance.get(
          `${USER_LINKED_DATA}/${userId}`
        );
        const data: LinkedData[] = response.data;
        const sortedStrengths = data
          .filter((item) => item.type === "strength")
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        const sortedWeaknesses = data
          .filter((item) => item.type === "weakness")
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        setStrengths(sortedStrengths);
        setWeaknesses(sortedWeaknesses);
      } catch (error) {
        console.error("Error fetching progress metrics:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const renderStats = (
    items: LinkedData[],
    showAll: boolean,
    setShowAll: (value: boolean) => void,
    title: string,
    limit: number = 2
  ) => {
    const displayedItems = showAll ? items : items.slice(0, limit);
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">{title}</h4>
        {displayedItems.length === 0 ? (
          <div className="text-muted-foreground">No stats available.</div>
        ) : (
          displayedItems.map((item) => (
            <div key={item.id} className="">
              <CardTitle className="text-sm text-gray-900 mb-2">
                {item.data}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Progress value={item.percentage} className="flex-1" />
                <span className="text-xs text-gray-500">
                  {item.percentage}%
                </span>
              </div>
            </div>
          ))
        )}
        {items.length > limit && (
          <MyButton
            buttonType="text"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="w-full text-sm font-medium text-gray-700"
          >
            {showAll ? "Show Less" : `View More (${items.length - limit})`}
          </MyButton>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Progress Stats
        </h3>
        <div className="text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Progress Stats
      </h3>
      <div className="space-y-6">
        {renderStats(
          strengths,
          showAllStrengths,
          setShowAllStrengths,
          "Strengths",
          2
        )}
        {renderStats(
          weaknesses,
          showAllWeaknesses,
          setShowAllWeaknesses,
          "Weaknesses",
          2
        )}
      </div>
    </div>
  );
};

export default ProgressStats;
