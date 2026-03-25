import React, { useEffect, useState, useMemo } from "react";
import { BASE_URL } from "@/constants/urls";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useStudyLibraryQuery } from "@/services/study-library/getStudyLibraryDetails";
import {
  useSubmitApplication,
  useSearchApplicant,
} from "@/hooks/use-parent-portal";
import { ChildProfile } from "@/types/parent-portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { handleFetchCompleteInstituteDetails } from "@/routes/study-library/courses/-services/institute-details";

type SessionOption = {
  id: string;
  packageName: string;
  levelName: string;
};

type ParentType = "FATHER" | "MOTHER" | null;

type ApplicationFormData = {
  // Parent Section
  father_name: string;
  father_phone: string;
  father_email: string;
  mother_name: string;
  mother_phone: string;
  mother_email: string;

  // Student Section
  child_name: string;
  child_dob: string | null;
  child_gender: string;
  blood_group?: string;
  mother_tongue?: string;
  languages_known?: string;
  category?: string;
  nationality?: string;

  // Academic Section
  previous_school_name?: string;
  previous_school_board?: string;
  last_class_attended?: string;
  last_exam_result?: string;
  subjects_studied?: string;
  applying_for_class?: string;
  academic_year?: string;
  board_preference?: string;

  // Address Section
  address_line: string;
  city: string;
  pin_code: string;

  // Identity Documents
  id_number?: string;
  id_type?: string;

  // Transfer Certificate
  tc_number?: string;
  tc_issue_date?: string;
  tc_pending?: boolean;

  // Medical & Special Needs
  has_special_education_needs?: boolean;
  is_physically_challenged?: boolean;
  medical_conditions?: string;
  dietary_restrictions?: string;
};

// Track which parent type to prefill
export function ParentApplicationForm({
  onComplete,
  destinationPackageSessionId,
  child,
}: {
  onComplete?: () => void;
  /** When provided the form auto-selects this session and the user cannot change it. */
  destinationPackageSessionId: string;
  /** Child profile to prefill student details */
  child: ChildProfile;
}) {
  const [trackingId, setTrackingId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [enquiryResult, setEnquiryResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [session, setSession] = useState<string>("");
  const [showParentTypePrompt, setShowParentTypePrompt] = useState(false);
  const { data: instituteData } = useSuspenseQuery(
    handleFetchCompleteInstituteDetails(),
  );

  const packageSessionLabel = useMemo(() => {
    if (!instituteData?.batches_for_sessions) return "";
    const batch = instituteData.batches_for_sessions.find(
      (b: any) => b.id === destinationPackageSessionId,
    );
    if (batch) {
      const pkgName = batch.package_dto?.package_name || "";
      const levelName = batch.level?.level_name || "";
      return levelName ? `${pkgName} - ${levelName}` : pkgName;
    }
    return "Selected Session";
  }, [instituteData, destinationPackageSessionId]);

  const sessionLabel = useMemo(() => {
    if (!instituteData?.batches_for_sessions) return "";
    const batch = instituteData.batches_for_sessions.find(
      (b: any) => b.id === destinationPackageSessionId,
    );
    if (batch) {
      setSession(batch.session.id);
      const pkgName = batch.session?.session_name || "";
      return pkgName;
    }
    return "Selected Session";
  }, [instituteData, destinationPackageSessionId]);

  const [parentTypeToPrefill, setParentTypeToPrefill] =
    useState<ParentType>(null);
  const searchQuery = useSearchApplicant(
    instituteData?.id || undefined,
    trackingId || undefined,
    searching,
  );

  const [form, setForm] = useState<ApplicationFormData>({
    // Parent
    father_name: "",
    father_phone: "",
    father_email: "",
    mother_name: "",
    mother_phone: "",
    mother_email: "",
    // Student
    child_name: child?.full_name || "",
    child_dob: child?.date_of_birth || null,
    child_gender: child?.gender || "MALE",
    blood_group: "",
    mother_tongue: "",
    languages_known: "",
    category: "",
    nationality: "",
    // Academic
    previous_school_name: "",
    previous_school_board: "",
    last_class_attended: "",
    last_exam_result: "",
    subjects_studied: "",
    applying_for_class: destinationPackageSessionId ?? "",
    academic_year: "",
    board_preference: "",
    // Address
    address_line: "",
    city: "",
    pin_code: "",
    // Identity
    id_number: "",
    id_type: "",
    // TC
    tc_number: "",
    tc_issue_date: "",
    tc_pending: false,
    // Medical
    has_special_education_needs: false,
    is_physically_challenged: false,
    medical_conditions: "",
    dietary_restrictions: "",
  });

  // Whenever destinationPackageSessionId arrives (or changes), lock the session
  useEffect(() => {
    if (destinationPackageSessionId) {
      setForm((f) => ({
        ...f,
        applying_for_class: destinationPackageSessionId,
      }));
    }
  }, [destinationPackageSessionId]);

  // Only set enquiry result when manually triggered
  useEffect(() => {
    if (searching && searchQuery.data) {
      setEnquiryResult(searchQuery.data);
      setShowParentTypePrompt(true);
      setSearching(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery.data]);

  // Prefill logic after parent type is selected
  useEffect(() => {
    if (!parentTypeToPrefill || !enquiryResult) return;
    const app = enquiryResult;
    const parent = app.parent || {};
    const child = app.child || {};
    let mapped: Partial<ApplicationFormData> = {
      address_line: parent.address_line || form.address_line,
      city: parent.city || form.city,
      pin_code: parent.pin_code || form.pin_code,
      child_name: child.name || form.child_name,
      child_dob: child.dob ? child.dob.split("T")[0] : form.child_dob,
      child_gender: child.gender || form.child_gender,
    };
    if (parentTypeToPrefill === "FATHER") {
      mapped = {
        ...mapped,
        father_name: parent.name || form.father_name,
        father_phone: parent.phone || form.father_phone,
        father_email: parent.email || form.father_email,
      };
    } else if (parentTypeToPrefill === "MOTHER") {
      mapped = {
        ...mapped,
        mother_name: parent.name || form.mother_name,
        mother_phone: parent.phone || form.mother_phone,
        mother_email: parent.email || form.mother_email,
      };
    }
    setForm((f) => ({ ...f, ...mapped }));
    setShowParentTypePrompt(false);
    setParentTypeToPrefill(null);
    toast.success("Enquiry data loaded");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentTypeToPrefill]);

  const submitMutation = useSubmitApplication();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteData?.id) {
      toast.error("Institute context not found");
      return;
    }

    const payload = {
      enquiry_id: trackingId || null,
      institute_id: instituteData?.id,
      session_id: session,
      source: "INSTITUTE",
      source_id: instituteData?.id,
      form_data: form,
      workflow_type: "APPLICATION",
      custom_field_values: {},
    };

    try {
      setSubmitting(true);
      const res = await submitMutation.mutateAsync(
        payload as unknown as Record<string, unknown>,
      );
      if (res) {
        // Try to create a payment order using available payment options
        try {
          // Fetch payment options for institute
          const paymentOptionsResp = await fetch(
            `${BASE_URL}/admin-core-service/payment/v1/get-payment-options`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("parent_token")}`,
              },
              body: JSON.stringify({
                types: ["ONE_TIME"],
                source: "INSTITUTE",
                source_id: instituteData?.id,
              }),
            },
          );

          if (paymentOptionsResp.ok) {
            const opts = await paymentOptionsResp.json();
            const option =
              Array.isArray(opts) && opts.length > 0 ? opts[0] : null;
            const plan = option?.payment_plans?.[0];

            if (option && plan) {
              const orderResp = await fetch(
                `${BASE_URL}/admin-core-service/payment/v1/create-order`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${localStorage.getItem("parent_token")}`,
                  },
                  body: JSON.stringify({
                    applicant_id: res.applicant_id || res.applicantId || null,
                    payment_option_id: option.id,
                    payment_plan_id: plan.id,
                    institute_id: instituteData?.id,
                    amount: plan.actual_price || plan.amount,
                    currency: plan.currency || "INR",
                  }),
                },
              );

              if (orderResp.ok) {
                const order = await orderResp.json();
                const link =
                  order.payment_link || order.paymentLink || order.order_url;
                if (link) {
                  window.location.href = link;
                  return;
                }
              }
            }
          }
        } catch {
          // ignore and continue
        }

        toast.success(
          "Application submitted. Go to payments to complete the fee.",
        );
        if (onComplete) onComplete();
      }
    } catch {
      // handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h2 className="text-lg font-semibold">Application Form</h2>
      <h4>Session : {sessionLabel}</h4>
      <div className="flex items-center gap-2">
        <Input
          placeholder="Enquiry / Tracking ID (optional)"
          value={trackingId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setTrackingId(e.target.value)
          }
        />
        <Button
          onClick={() => {
            if (!trackingId) return toast.error("Enter tracking id");
            if (!instituteData?.id)
              return toast.error("Institute context not found");
            setSearching(true);
          }}
          className="bg-blue-500"
          disabled={searching}
        >
          {searching ? "Loading..." : "Load Enquiry"}
        </Button>
      </div>

      {/* Prompt for parent type selection if needed */}
      {showParentTypePrompt && (
        <div className="mb-4 p-4 border rounded bg-gray-50 flex flex-col items-start">
          <span className="mb-2">
            Is the enquiry parent the Father or Mother?
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setParentTypeToPrefill("FATHER")}
            >
              Father
            </Button>
            <Button
              variant="outline"
              onClick={() => setParentTypeToPrefill("MOTHER")}
            >
              Mother
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Student Section */}
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">Student Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs">Student Name</label>
              <Input
                value={form.child_name}
                onChange={(e) =>
                  setForm({ ...form, child_name: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="text-xs">Date of Birth</label>
              <Input
                type="date"
                value={form.child_dob ?? ""}
                onChange={(e) =>
                  setForm({ ...form, child_dob: e.target.value })
                }
                required
              />
            </div>
            <div>
              <label className="text-xs">Gender</label>
              <Select
                value={form.child_gender}
                onValueChange={(value) =>
                  setForm({ ...form, child_gender: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs">Blood Group</label>
              <Input
                value={form.blood_group}
                onChange={(e) =>
                  setForm({ ...form, blood_group: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Mother Tongue</label>
              <Input
                value={form.mother_tongue}
                onChange={(e) =>
                  setForm({ ...form, mother_tongue: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Languages Known</label>
              <Input
                value={form.languages_known}
                onChange={(e) =>
                  setForm({ ...form, languages_known: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Category</label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs">Nationality</label>
              <Input
                value={form.nationality}
                onChange={(e) =>
                  setForm({ ...form, nationality: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Parent Section */}
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">Parent Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs">Father Name</label>
              <Input
                value={form.father_name}
                onChange={(e) =>
                  setForm({ ...form, father_name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Father Phone</label>
              <Input
                value={form.father_phone}
                onChange={(e) =>
                  setForm({ ...form, father_phone: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Father Email</label>
              <Input
                value={form.father_email}
                onChange={(e) =>
                  setForm({ ...form, father_email: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Mother Name</label>
              <Input
                value={form.mother_name}
                onChange={(e) =>
                  setForm({ ...form, mother_name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Mother Phone</label>
              <Input
                value={form.mother_phone}
                onChange={(e) =>
                  setForm({ ...form, mother_phone: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Mother Email</label>
              <Input
                value={form.mother_email}
                onChange={(e) =>
                  setForm({ ...form, mother_email: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Academic Section */}
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">Academic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs">Previous School Name</label>
              <Input
                value={form.previous_school_name}
                onChange={(e) =>
                  setForm({ ...form, previous_school_name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Previous School Board</label>
              <Input
                value={form.previous_school_board}
                onChange={(e) =>
                  setForm({ ...form, previous_school_board: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Last Class Attended</label>
              <Input
                value={form.last_class_attended}
                onChange={(e) =>
                  setForm({ ...form, last_class_attended: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Last Exam Result</label>
              <Input
                value={form.last_exam_result}
                onChange={(e) =>
                  setForm({ ...form, last_exam_result: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Subjects Studied</label>
              <Input
                value={form.subjects_studied}
                onChange={(e) =>
                  setForm({ ...form, subjects_studied: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs flex items-center gap-1">
                Applying For Class
              </label>
              <div className="flex items-center gap-2 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-medium">
                <span className="flex-1 truncate">{packageSessionLabel}</span>
              </div>
            </div>
            <div>
              <label className="text-xs">Academic Year</label>
              <Input
                value={form.academic_year}
                onChange={(e) =>
                  setForm({ ...form, academic_year: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Board Preference</label>
              <Input
                value={form.board_preference}
                onChange={(e) =>
                  setForm({ ...form, board_preference: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Address Section */}
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">Address Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs">Address Line</label>
              <Input
                value={form.address_line}
                onChange={(e) =>
                  setForm({ ...form, address_line: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">City</label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs">PIN Code</label>
              <Input
                value={form.pin_code}
                onChange={(e) => setForm({ ...form, pin_code: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Identity Documents Section */}
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">Identity Documents</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs">ID Number</label>
              <Input
                value={form.id_number}
                onChange={(e) =>
                  setForm({ ...form, id_number: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">ID Type</label>
              <Input
                value={form.id_type}
                onChange={(e) => setForm({ ...form, id_type: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Transfer Certificate Section */}
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">Transfer Certificate (TC)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs">TC Number</label>
              <Input
                value={form.tc_number}
                onChange={(e) =>
                  setForm({ ...form, tc_number: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">TC Issue Date</label>
              <Input
                type="date"
                value={form.tc_issue_date || ""}
                onChange={(e) =>
                  setForm({ ...form, tc_issue_date: e.target.value })
                }
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                checked={form.tc_pending || false}
                onCheckedChange={(checked) =>
                  setForm({ ...form, tc_pending: !!checked })
                }
                id="tc_pending"
              />
              <label className="text-xs" htmlFor="tc_pending">
                TC Pending
              </label>
            </div>
          </div>
        </div>

        {/* Medical & Special Needs Section */}
        <div className="border rounded p-4">
          <h3 className="font-semibold mb-2">Medical & Special Needs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.has_special_education_needs || false}
                onCheckedChange={(checked) =>
                  setForm({ ...form, has_special_education_needs: !!checked })
                }
                id="special_needs"
              />
              <label className="text-xs" htmlFor="special_needs">
                Has Special Education Needs
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.is_physically_challenged || false}
                onCheckedChange={(checked) =>
                  setForm({ ...form, is_physically_challenged: !!checked })
                }
                id="physically_challenged"
              />
              <label className="text-xs" htmlFor="physically_challenged">
                Is Physically Challenged
              </label>
            </div>
            <div>
              <label className="text-xs">Medical Conditions</label>
              <Input
                value={form.medical_conditions}
                onChange={(e) =>
                  setForm({ ...form, medical_conditions: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-xs">Dietary Restrictions</label>
              <Input
                value={form.dietary_restrictions}
                onChange={(e) =>
                  setForm({ ...form, dietary_restrictions: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting} className="bg-blue-700">
            {submitting ? "Submitting..." : "Submit Application"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setForm({
                father_name: "",
                father_phone: "",
                father_email: "",
                mother_name: "",
                mother_phone: "",
                mother_email: "",
                child_name: child?.full_name || "",
                child_dob: child?.date_of_birth || null,
                child_gender: child?.gender || "MALE",
                blood_group: "",
                mother_tongue: "",
                languages_known: "",
                category: "",
                nationality: "",
                previous_school_name: "",
                previous_school_board: "",
                last_class_attended: "",
                last_exam_result: "",
                subjects_studied: "",
                applying_for_class: destinationPackageSessionId ?? "",
                academic_year: "",
                board_preference: "",
                address_line: "",
                city: "",
                pin_code: "",
                id_number: "",
                id_type: "",
                tc_number: "",
                tc_issue_date: "",
                tc_pending: false,
                has_special_education_needs: false,
                is_physically_challenged: false,
                medical_conditions: "",
                dietary_restrictions: "",
              });
            }}
          >
            Reset
          </Button>
        </div>
      </form>
    </div>
  );
}
