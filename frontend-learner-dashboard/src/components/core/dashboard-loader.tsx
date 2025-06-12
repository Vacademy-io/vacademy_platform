import { useTheme } from "@/providers/theme/theme-provider";
import ClipLoader from "react-spinners/ClipLoader";
export function DashboardLoader() {
  const { primaryColor } = useTheme();
  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <ClipLoader size={40} color={primaryColor} />
      <p>Loading...</p>
    </div>
  );
}
