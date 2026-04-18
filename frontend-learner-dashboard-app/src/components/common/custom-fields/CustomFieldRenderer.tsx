import { useState } from "react";
import { MyInput } from "@/components/design-system/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import { useFileUpload } from "@/hooks/use-file-upload";
import { getTokenFromCookie, getTokenDecodedData } from "@/lib/auth/sessionUtility";
import { TokenKey } from "@/constants/auth/tokens";
import {
  FieldRenderType,
  parseFieldConfig,
  parseDropdownOptions,
  type CustomFieldFullConfig,
} from "@/components/common/enroll-by-invite/-utils/custom-field-helpers";

interface CustomFieldRendererProps {
  type: FieldRenderType | string;
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  options?: Array<{ _id?: number; value: string; label: string }>;
  config?: string | CustomFieldFullConfig | null;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Shared renderer for learner-facing custom fields.
 *
 * Handles all 11 field types:
 *   text, number, email, url, phone, date, textarea, checkbox, radio, dropdown, file
 *
 * For `file` fields, uploads via the existing S3 signed-URL flow on change
 * and stores the resulting public URL as the field value.
 */
export const CustomFieldRenderer = ({
  type,
  name,
  value,
  onChange,
  options,
  config,
  required = false,
  disabled = false,
  placeholder,
}: CustomFieldRendererProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const { uploadFile, uploadFilePublic, getPublicUrl, getPublicUrlWithoutLogin } = useFileUpload();

  // Normalise the render type
  const normalizedType = String(type).toUpperCase() as FieldRenderType;

  // Resolve options: prefer explicit options prop, else parse from config.
  // Only parse for types that actually use options to avoid spurious
  // "Empty or invalid config" console warnings for date/text/checkbox/etc.
  const needsOptions =
    normalizedType === FieldRenderType.DROPDOWN ||
    normalizedType === FieldRenderType.RADIO;
  const resolvedOptions =
    options && options.length > 0
      ? options
      : needsOptions && typeof config === "string"
        ? parseDropdownOptions(config)
        : undefined;

  // Resolve file constraints from config
  const parsedConfig: CustomFieldFullConfig | undefined =
    typeof config === "string"
      ? parseFieldConfig(config)
      : (config ?? undefined) || undefined;
  const allowedFileTypes = parsedConfig?.allowedFileTypes;
  const maxSizeMB = parsedConfig?.maxSizeMB;

  const handleChange = (newValue: string) => {
    onChange?.(newValue);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (allowedFileTypes && allowedFileTypes.length > 0) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!allowedFileTypes.some((t) => t.toLowerCase() === ext)) {
        alert(`File type .${ext} is not allowed. Allowed: ${allowedFileTypes.join(", ")}`);
        e.target.value = "";
        return;
      }
    }

    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
      alert(`File size must be less than ${maxSizeMB}MB`);
      e.target.value = "";
      return;
    }

    try {
      setIsUploading(true);

      // Detect whether the user is logged in to pick the right upload path.
      // Public pages (live-class registration, audience-response) don't have
      // an auth token, so we use the unauthenticated /media-service/public/*
      // endpoints instead.
      let token: string | null = null;
      let userId = "anonymous";
      try {
        token = getTokenFromCookie(TokenKey.accessToken);
        const decoded = token ? getTokenDecodedData(token) : null;
        if (decoded?.user) userId = decoded.user;
      } catch {
        // no token — public context
      }

      let fileId: string | undefined;
      if (token) {
        // Authenticated path: signed-URL → S3 PUT → acknowledge
        fileId = await uploadFile({
          file,
          setIsUploading,
          userId,
          source: "CUSTOM_FIELD",
          sourceId: "CUSTOM_FIELD_VALUE",
        });
      } else {
        // Public path: public signed-URL → S3 PUT (no acknowledge needed)
        fileId = await uploadFilePublic({
          file,
          source: "CUSTOM_FIELD",
          sourceId: "PUBLIC_UPLOAD",
        });
      }

      if (fileId) {
        const url = token
          ? await getPublicUrl(fileId)
          : await getPublicUrlWithoutLogin(fileId);
        const finalValue = url || fileId;
        setUploadedFileName(file.name);
        handleChange(finalValue);
      }
    } catch (err) {
      console.error("File upload failed:", err);
      alert("File upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  switch (normalizedType) {
    case FieldRenderType.TEXT:
      return (
        <MyInput
          inputType="text"
          inputPlaceholder={placeholder || `Enter ${name}`}
          input={value || ""}
          onChangeFunction={(e) => handleChange(e.target.value)}
          size="large"
          className="w-full"
          disabled={disabled}
          required={required}
        />
      );

    case FieldRenderType.NUMBER:
      return (
        <MyInput
          inputType="number"
          inputPlaceholder={placeholder || `Enter ${name}`}
          input={value || ""}
          onChangeFunction={(e) => handleChange(e.target.value)}
          size="large"
          className="w-full"
          disabled={disabled}
          required={required}
        />
      );

    case FieldRenderType.EMAIL:
      return (
        <MyInput
          inputType="email"
          inputPlaceholder={placeholder || `Enter ${name}`}
          input={value || ""}
          onChangeFunction={(e) => handleChange(e.target.value)}
          size="large"
          className="w-full"
          disabled={disabled}
          required={required}
        />
      );

    case FieldRenderType.URL:
      return (
        <MyInput
          inputType="url"
          inputPlaceholder={placeholder || `Enter ${name}`}
          input={value || ""}
          onChangeFunction={(e) => handleChange(e.target.value)}
          size="large"
          className="w-full"
          disabled={disabled}
          required={required}
        />
      );

    case FieldRenderType.PHONE:
      return (
        <PhoneInput
          country="in"
          value={value || ""}
          onChange={(val) => {
            const formatted = val.startsWith("+") ? val : `+${val}`;
            handleChange(formatted);
          }}
          enableSearch={true}
          disabled={disabled}
          placeholder={placeholder || `Enter ${name}`}
          inputStyle={{ width: "100%" }}
          containerStyle={{ width: "100%" }}
        />
      );

    case FieldRenderType.DATE:
      // Using native date input because the learner app's Calendar component
      // is a react-date-range *range* picker (mode="range" only), not a
      // single-date picker. The native <input type="date"> gives a good UX
      // on all modern browsers and avoids the component mismatch crash.
      return (
        <input
          type="date"
          value={value || ""}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          required={required}
          placeholder={placeholder || "Pick a date"}
          className="flex w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      );

    case FieldRenderType.TEXTAREA:
      return (
        <Textarea
          placeholder={placeholder || `Enter ${name}`}
          value={value || ""}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          required={required}
          rows={3}
          className="min-h-[60px] w-full"
        />
      );

    case FieldRenderType.CHECKBOX:
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={value === "true"}
            onCheckedChange={(checked) =>
              handleChange(checked === true ? "true" : "false")
            }
            disabled={disabled}
          />
          <Label className="text-sm">{name}</Label>
        </div>
      );

    case FieldRenderType.DROPDOWN:
      return (
        <Select
          value={value || ""}
          onValueChange={handleChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder={placeholder || `Select ${name}`} />
          </SelectTrigger>
          <SelectContent>
            {(resolvedOptions || []).map((opt, idx) => (
              <SelectItem key={opt._id ?? idx} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case FieldRenderType.RADIO:
      // Wrapped in a div so that FormControl's Slot doesn't merge its
      // id / aria-* props directly onto the Radix RadioGroup root, which
      // breaks internal ID management and makes items unclickable.
      return (
        <div>
          <RadioGroup
            value={value || ""}
            onValueChange={handleChange}
            disabled={disabled}
            className="flex flex-col gap-2"
          >
            {(resolvedOptions || []).map((opt, idx) => (
              <div key={opt._id ?? idx} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`${name}-${idx}`} />
                <Label htmlFor={`${name}-${idx}`}>{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      );

    case FieldRenderType.FILE: {
      const acceptAttr = allowedFileTypes?.length
        ? allowedFileTypes.map((t) => `.${t}`).join(",")
        : undefined;
      const isValidUrl =
        value && (value.startsWith("http://") || value.startsWith("https://"));
      return (
        <div className="flex flex-col gap-2">
          <input
            type="file"
            accept={acceptAttr}
            disabled={disabled || isUploading}
            onChange={handleFileChange}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm file:mr-4 file:rounded file:border-0 file:bg-primary-50 file:px-4 file:py-1 file:text-sm file:font-medium file:text-primary-700 hover:file:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {isUploading && (
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Loader2 className="size-4 animate-spin" />
              Uploading...
            </div>
          )}
          {!isUploading && uploadedFileName && (
            <div className="text-xs text-success-600">Uploaded: {uploadedFileName}</div>
          )}
          {!isUploading && !uploadedFileName && isValidUrl && (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-500 underline"
            >
              View current file
            </a>
          )}
          {allowedFileTypes && allowedFileTypes.length > 0 && (
            <p className="text-xs text-neutral-500">
              Allowed: {allowedFileTypes.join(", ")}
              {maxSizeMB && ` · Max ${maxSizeMB}MB`}
            </p>
          )}
        </div>
      );
    }

    default:
      return (
        <MyInput
          inputType="text"
          inputPlaceholder={placeholder || `Enter ${name}`}
          input={value || ""}
          onChangeFunction={(e) => handleChange(e.target.value)}
          size="large"
          className="w-full"
          disabled={disabled}
          required={required}
        />
      );
  }
};
