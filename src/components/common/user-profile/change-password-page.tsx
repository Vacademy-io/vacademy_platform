import { MyButton } from "@/components/design-system/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "@tanstack/react-router";
import { X } from "phosphor-react";

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const handleClose = () => {
    navigate({ to: "/dashboard" });
  };
  return (
    <div className="bg-white relative rounded-lg h-screen w-full max-w-md mx-auto shadow-lg sm:max-w-md md:max-w-lg lg:max-w-xl">
      {" "}
      {/* Header */}
      <div className="p-3 flex items-center justify-between border-b sticky top-0 bg-white z-10">
        <h1 className="text-lg font-medium text-primary-500">
          Change Password
        </h1>
        <button onClick={handleClose} className="text-gray-500">
          <X size={20} weight="bold" />
        </button>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-xs">
            Old Password*
          </Label>
          <Input
            id="full_name"
            // value={formData.full_name}
            // onChange={(e) => handleChange("full_name", e.target.value)}
            placeholder="Enter your full name"
            required
            className="h-10 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-xs">
            New Password*
          </Label>
          <Input
            id="full_name"
            // value={formData.full_name}
            // onChange={(e) => handleChange("full_name", e.target.value)}
            placeholder="Enter your full name"
            required
            className="h-10 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-xs">
            Confirm New Password*
          </Label>
          <Input
            id="full_name"
            // value={formData.full_name}
            // onChange={(e) => handleChange("full_name", e.target.value)}
            placeholder="Enter your full name"
            required
            className="h-10 text-sm"
          />
        </div>
      </div>
      <div className="mt-auto fixed bottom-4 left-1/2 -translate-x-1/2 bg-white">
        <MyButton
          type="submit"
          className="w-full"
          //   isLoading={isLoading}
          //   onClick={handleSubmit}
        >
          Change Password
        </MyButton>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
