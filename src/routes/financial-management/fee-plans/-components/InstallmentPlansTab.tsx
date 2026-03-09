// @ts-nocheck
import React, { useState, useMemo } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────────────

const FEE_TYPES = [
  { id: "tuition", label: "Tuition Fee", icon: "📚", color: "#6366f1", mandatory: true },
  { id: "bus", label: "Bus / Transport", icon: "🚌", color: "#f59e0b", mandatory: false },
  { id: "annual", label: "Annual Charges", icon: "📅", color: "#10b981", mandatory: true },
  { id: "exam", label: "Exam Fee", icon: "✏️", color: "#ef4444", mandatory: true },
  { id: "library", label: "Library Fee", icon: "📖", color: "#8b5cf6", mandatory: false },
  { id: "sports", label: "Sports Fee", icon: "⚽", color: "#06b6d4", mandatory: false },
  { id: "lab", label: "Lab Fee", icon: "🔬", color: "#f97316", mandatory: false },
  { id: "hostel", label: "Hostel / Mess", icon: "🏠", color: "#84cc16", mandatory: false },
  { id: "computer", label: "Computer Fee", icon: "💻", color: "#0ea5e9", mandatory: true },
  { id: "custom", label: "Custom Fee", icon: "➕", color: "#6b7280", mandatory: false },
];

const CLASSES = [
  "Play Group", "Nursery", "LKG", "UKG",
  "Class 1", "Class 2", "Class 3", "Class 4", "Class 5",
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10",
  "Class 11", "Class 12",
];

const INSTALLMENT_PRESETS = [
  { label: "Annual", count: 1 },
  { label: "Half-Yearly", count: 2 },
  { label: "Quarterly", count: 4 },
  { label: "Monthly", count: 12 },
  { label: "Custom", count: null },
];

const MONTHS = [
  "April", "May", "June", "July", "August", "September",
  "October", "November", "December", "January", "February", "March"
];

function generateInstallments(count, totalAmount) {
  const perInstallment = totalAmount ? Math.floor(totalAmount / count) : 0;
  const remainder = totalAmount ? totalAmount - perInstallment * count : 0;
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    label: count === 12 ? MONTHS[i % 12] : count === 4 ? `Q${i+1}` : count === 2 ? `H${i+1}` : `Payment ${i + 1}`,
    amount: i === 0 ? perInstallment + remainder : perInstallment,
    dueDate: "",
    isMandatory: true,
  }));
}

const initialPlan = {
  id: Date.now(),
  name: "",
  feeType: "",
  customFeeName: "",
  classes: [],
  admissionType: "all",
  totalAmount: "",
  gst: "none",
  installmentPreset: "Quarterly",
  customCount: "",
  installments: generateInstallments(4, 0),
  academicYear: "2025-26",
  status: "active",
  isMandatory: true,
};

// ─── DEMO / SEED DATA ──────────────────────────────────────────────────────────

const SEED_PLANS = [
  {
    id: 1001, name: "Tuition Fee – Primary (1-5)", feeType: "tuition", customFeeName: "",
    classes: ["Class 1","Class 2","Class 3","Class 4","Class 5"], admissionType: "all",
    totalAmount: "50000", gst: "none", installmentPreset: "Quarterly", customCount: "",
    installments: generateInstallments(4, 50000), academicYear: "2025-26", status: "active", isMandatory: true,
  },
  {
    id: 1002, name: "Tuition Fee – Middle (6-8)", feeType: "tuition", customFeeName: "",
    classes: ["Class 6","Class 7","Class 8"], admissionType: "all",
    totalAmount: "60000", gst: "none", installmentPreset: "Quarterly", customCount: "",
    installments: generateInstallments(4, 60000), academicYear: "2025-26", status: "active", isMandatory: true,
  },
  {
    id: 1003, name: "Bus Fee – All Classes", feeType: "bus", customFeeName: "",
    classes: ["Class 1","Class 2","Class 3","Class 4","Class 5","Class 6","Class 7","Class 8","Class 9","Class 10"],
    admissionType: "all", totalAmount: "12000", gst: "none", installmentPreset: "Annual", customCount: "",
    installments: generateInstallments(1, 12000), academicYear: "2025-26", status: "active", isMandatory: false,
  },
  {
    id: 1004, name: "Computer Fee – All Classes", feeType: "computer", customFeeName: "",
    classes: ["Class 1","Class 2","Class 3","Class 4","Class 5","Class 6","Class 7","Class 8","Class 9","Class 10"],
    admissionType: "all", totalAmount: "3000", gst: "none", installmentPreset: "Annual", customCount: "",
    installments: generateInstallments(1, 3000), academicYear: "2025-26", status: "active", isMandatory: true,
  },
  {
    id: 1005, name: "Exam Fee – Senior (9-10)", feeType: "exam", customFeeName: "",
    classes: ["Class 9","Class 10"], admissionType: "all",
    totalAmount: "5000", gst: "none", installmentPreset: "Half-Yearly", customCount: "",
    installments: generateInstallments(2, 5000), academicYear: "2025-26", status: "draft", isMandatory: true,
  },
];


// ─── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 38, height: 20, borderRadius: 10,
        background: value ? "#6366f1" : "#d1d5db",
        position: "relative", transition: "background 0.2s",
        cursor: "pointer", flexShrink: 0,
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: value ? 20 : 2,
        width: 16, height: 16, borderRadius: "50%",
        background: "#fff", transition: "left 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.18)"
      }} />
    </div>
  );
}

function MultiSelect({ options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val));
    else onChange([...selected, val]);
  };

  const selectAll = () => onChange([...options]);
  const clearAll = () => onChange([]);

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          border: "1.5px solid #e5e7eb", borderRadius: 10, padding: "8px 12px",
          cursor: "pointer", minHeight: 42, display: "flex", flexWrap: "wrap",
          gap: 4, alignItems: "center", background: "#fff",
          transition: "border-color 0.2s",
          ...(open ? { borderColor: "#6366f1", boxShadow: "0 0 0 3px #6366f122" } : {}),
        }}
      >
        {selected.length === 0
          ? <span style={{ color: "#9ca3af", fontSize: 13 }}>{placeholder}</span>
          : selected.length <= 4
            ? selected.map(s => (
              <span key={s} style={{
                background: "#ede9fe", color: "#6366f1", borderRadius: 6,
                padding: "1px 8px", fontSize: 11, fontWeight: 600,
              }}>{s}</span>
            ))
            : <span style={{ color: "#6366f1", fontSize: 13, fontWeight: 600 }}>{selected.length} classes selected</span>
        }
        <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: 10 }}>▾</span>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100,
          maxHeight: 240, overflowY: "auto",
        }}>
          <div style={{ display: "flex", gap: 8, padding: "8px 12px", borderBottom: "1px solid #f1f5f9" }}>
            <button onClick={selectAll} style={{ fontSize: 11, color: "#6366f1", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Select All</button>
            <button onClick={clearAll} style={{ fontSize: 11, color: "#ef4444", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
          </div>
          {options.map(opt => (
            <div
              key={opt}
              onClick={() => toggle(opt)}
              style={{
                padding: "8px 14px", cursor: "pointer", display: "flex",
                alignItems: "center", gap: 8, fontSize: 13,
                background: selected.includes(opt) ? "#ede9fe" : "transparent",
                color: selected.includes(opt) ? "#6366f1" : "#374151",
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: 4,
                border: `2px solid ${selected.includes(opt) ? "#6366f1" : "#d1d5db"}`,
                background: selected.includes(opt) ? "#6366f1" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {selected.includes(opt) && <span style={{ color: "#fff", fontSize: 10, fontWeight: 800 }}>✓</span>}
              </span>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InstallmentTable({ installments, onChange, totalAmount }) {
  const updateInstallment = (id, field, value) => {
    onChange(installments.map(inst =>
      inst.id === id ? { ...inst, [field]: value } : inst
    ));
  };
  const total = installments.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);
  const diff = (parseFloat(totalAmount) || 0) - total;

  return (
    <div style={{ overflowX: "auto" }}>
      {diff !== 0 && totalAmount && (
        <div style={{
          background: Math.abs(diff) < 1 ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${Math.abs(diff) < 1 ? "#bbf7d0" : "#fecaca"}`,
          borderRadius: 8, padding: "6px 12px", marginBottom: 8,
          fontSize: 12, color: Math.abs(diff) < 1 ? "#16a34a" : "#dc2626",
        }}>
          {diff > 0
            ? `⚠️ ₹${diff.toFixed(0)} remaining to allocate`
            : `⚠️ Exceeds total by ₹${Math.abs(diff).toFixed(0)}`}
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            {["#", "Label", "Amount (₹)", "Due Date", "Mandatory"].map(h => (
              <th key={h} style={{
                padding: "8px 12px", textAlign: "left", fontWeight: 700,
                color: "#374151", borderBottom: "2px solid #e5e7eb", whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {installments.map((inst, idx) => (
            <tr key={inst.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td style={{ padding: "7px 12px", color: "#9ca3af", fontWeight: 600 }}>{idx + 1}</td>
              <td style={{ padding: "7px 12px" }}>
                <input value={inst.label} onChange={e => updateInstallment(inst.id, "label", e.target.value)}
                  style={{ border: "1.5px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 12, width: 100, outline: "none" }} />
              </td>
              <td style={{ padding: "7px 12px" }}>
                <input type="number" value={inst.amount} onChange={e => updateInstallment(inst.id, "amount", e.target.value)}
                  style={{ border: "1.5px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 12, width: 90, outline: "none" }} />
              </td>
              <td style={{ padding: "7px 12px" }}>
                <input type="date" value={inst.dueDate} onChange={e => updateInstallment(inst.id, "dueDate", e.target.value)}
                  style={{ border: "1.5px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 12, outline: "none" }} />
              </td>
              <td style={{ padding: "7px 12px" }}>
                <Toggle value={inst.isMandatory} onChange={v => updateInstallment(inst.id, "isMandatory", v)} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#f8fafc" }}>
            <td colSpan={2} style={{ padding: "8px 12px", fontWeight: 700 }}>Total</td>
            <td style={{ padding: "8px 12px", fontWeight: 700, color: total === parseFloat(totalAmount) ? "#16a34a" : "#374151" }}>
              ₹{total.toLocaleString("en-IN")}
            </td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const labelStyle = {
  display: "block", fontSize: 12, fontWeight: 700,
  color: "#374151", marginBottom: 6, letterSpacing: 0.3,
  textTransform: "uppercase" as const,
};

const inputStyle = {
  width: "100%", border: "1.5px solid #e5e7eb", borderRadius: 10,
  padding: "10px 14px", fontSize: 14, fontFamily: "'DM Sans', sans-serif",
  outline: "none", boxSizing: "border-box" as const, transition: "border-color 0.2s",
  color: "#0f172a",
};


// ─── Plan Creator Modal ─────────────────────────────────────────────────────────

function PlanCreatorModal({ onSave, onClose, editPlan }) {
  const [plan, setPlan] = useState(editPlan || { ...initialPlan, id: Date.now() });
  const [step, setStep] = useState(1);

  const update = (field, value) => setPlan(p => ({ ...p, [field]: value }));

  const handlePreset = (preset) => {
    update("installmentPreset", preset.label);
    if (preset.count) {
      const installments = generateInstallments(preset.count, parseFloat(plan.totalAmount) || 0);
      setPlan(p => ({ ...p, installmentPreset: preset.label, installments }));
    }
  };

  const handleCustomCount = (count) => {
    update("customCount", count);
    const n = parseInt(count);
    if (n > 0 && n <= 60) {
      const installments = generateInstallments(n, parseFloat(plan.totalAmount) || 0);
      setPlan(p => ({ ...p, customCount: count, installments }));
    }
  };

  const handleTotalChange = (val) => {
    const count = plan.installments.length;
    const installments = generateInstallments(count, parseFloat(val) || 0);
    setPlan(p => ({ ...p, totalAmount: val, installments }));
  };

  const selectedFeeType = FEE_TYPES.find(f => f.id === plan.feeType);
  const isValid = step === 1
    ? plan.feeType && plan.classes.length > 0 && plan.name
    : plan.totalAmount && plan.installments.every(i => i.amount >= 0);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        background: "#fff", borderRadius: 20, width: "min(780px, 96vw)",
        maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 25px 60px rgba(0,0,0,0.22)",
      }}>
        {/* Header */}
        <div style={{ padding: "24px 28px 0", borderBottom: "1px solid #f1f5f9", paddingBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
                {editPlan ? "Edit" : "Create"} Fee Plan
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: -0.5 }}>
                {step === 1 ? "Fee Type & Configuration" : "Amount & Installments"}
              </h2>
            </div>
            <button onClick={onClose} style={{
              background: "#f1f5f9", border: "none", borderRadius: 10,
              width: 36, height: 36, cursor: "pointer", fontSize: 18, color: "#64748b",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {[{ n: 1, l: "Fee Details" }, { n: 2, l: "Amount & Schedule" }].map(s => (
              <div key={s.n} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: s.n <= step ? "#6366f1" : "#e5e7eb",
                  color: s.n <= step ? "#fff" : "#9ca3af",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, transition: "all 0.2s",
                }}>{s.n}</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.n <= step ? "#6366f1" : "#9ca3af" }}>{s.l}</span>
                {s.n === 1 && <span style={{ color: "#d1d5db", margin: "0 4px" }}>→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 28px" }}>
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Plan Name */}
              <div>
                <label style={labelStyle}>Plan Name <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  placeholder="e.g. Tuition Fee – Class 1 to 5"
                  value={plan.name}
                  onChange={e => update("name", e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Fee Type */}
              <div>
                <label style={labelStyle}>Fee Type <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                  {FEE_TYPES.map(ft => (
                    <button
                      key={ft.id}
                      onClick={() => {
                        update("feeType", ft.id);
                        update("isMandatory", ft.mandatory);
                      }}
                      style={{
                        border: `2px solid ${plan.feeType === ft.id ? ft.color : "#e5e7eb"}`,
                        borderRadius: 10, padding: "10px 8px",
                        background: plan.feeType === ft.id ? ft.color + "11" : "#fff",
                        cursor: "pointer", textAlign: "left",
                        transition: "all 0.15s",
                        display: "flex", alignItems: "center", gap: 7,
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{ft.icon}</span>
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: plan.feeType === ft.id ? ft.color : "#374151",
                      }}>{ft.label}</span>
                    </button>
                  ))}
                </div>
                {plan.feeType === "custom" && (
                  <input
                    placeholder="Enter custom fee name"
                    value={plan.customFeeName}
                    onChange={e => update("customFeeName", e.target.value)}
                    style={{ ...inputStyle, marginTop: 8 }}
                  />
                )}
              </div>

              {/* Classes + Applicable To */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Applicable Classes <span style={{ color: "#ef4444" }}>*</span></label>
                  <MultiSelect
                    options={CLASSES}
                    selected={plan.classes}
                    onChange={v => update("classes", v)}
                    placeholder="Select classes..."
                  />
                </div>
                <div>
                  <label style={labelStyle}>Applies To</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[
                      { value: "all", label: "All Students" },
                      { value: "new", label: "New Admissions" },
                      { value: "existing", label: "Existing Only" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => update("admissionType", opt.value)}
                        style={{
                          border: `2px solid ${plan.admissionType === opt.value ? "#6366f1" : "#e5e7eb"}`,
                          borderRadius: 8, padding: "7px 14px",
                          background: plan.admissionType === opt.value ? "#ede9fe" : "#fff",
                          color: plan.admissionType === opt.value ? "#6366f1" : "#374151",
                          cursor: "pointer", fontSize: 13, fontWeight: 600,
                          transition: "all 0.15s",
                        }}
                      >{opt.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mandatory + Academic Year + GST */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Mandatory Fee?</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                    <Toggle value={plan.isMandatory} onChange={v => update("isMandatory", v)} />
                    <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                      {plan.isMandatory ? "Yes – auto-assigned" : "No – optional"}
                    </span>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Academic Year</label>
                  <select value={plan.academicYear} onChange={e => update("academicYear", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="2024-25">2024-25</option>
                    <option value="2025-26">2025-26</option>
                    <option value="2026-27">2026-27</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>GST (%)</label>
                  <select value={plan.gst} onChange={e => update("gst", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="none">None</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Summary Bar */}
              <div style={{
                background: "linear-gradient(135deg, #6366f111 0%, #8b5cf611 100%)",
                border: "1.5px solid #e0e7ff", borderRadius: 12, padding: "14px 18px",
                display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Plan</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>{plan.name || "Untitled"}</div>
                </div>
                {selectedFeeType && (
                  <div>
                    <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Fee Type</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>{selectedFeeType.icon} {selectedFeeType.label}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Classes</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1e1b4b" }}>
                    {plan.classes.length <= 3 ? plan.classes.join(", ") : `${plan.classes.length} classes`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8 }}>Type</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: plan.isMandatory ? "#16a34a" : "#f59e0b" }}>
                    {plan.isMandatory ? "✓ Mandatory" : "Optional"}
                  </div>
                </div>
              </div>

              {/* Total Amount */}
              <div>
                <label style={labelStyle}>Total Annual Amount (₹) <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  type="number"
                  placeholder="e.g. 50000"
                  value={plan.totalAmount}
                  onChange={e => handleTotalChange(e.target.value)}
                  style={{ ...inputStyle, fontSize: 20, fontWeight: 700 }}
                />
              </div>

              {/* Installment Frequency */}
              <div>
                <label style={labelStyle}>Payment Frequency</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {INSTALLMENT_PRESETS.map(preset => (
                    <button
                      key={preset.label}
                      onClick={() => handlePreset(preset)}
                      style={{
                        border: `2px solid ${plan.installmentPreset === preset.label ? "#6366f1" : "#e5e7eb"}`,
                        borderRadius: 8, padding: "7px 14px",
                        background: plan.installmentPreset === preset.label ? "#ede9fe" : "#fff",
                        color: plan.installmentPreset === preset.label ? "#6366f1" : "#374151",
                        cursor: "pointer", fontSize: 13, fontWeight: 600,
                        transition: "all 0.15s",
                      }}
                    >
                      {preset.label}
                      {preset.count && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>({preset.count}x)</span>}
                    </button>
                  ))}
                </div>
                {plan.installmentPreset === "Custom" && (
                  <div style={{ marginTop: 8 }}>
                    <input type="number" min={1} max={60}
                      placeholder="Number of installments"
                      value={plan.customCount}
                      onChange={e => handleCustomCount(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>

              {/* Installment Table */}
              <div>
                <label style={labelStyle}>Installment Breakdown</label>
                <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                  <InstallmentTable
                    installments={plan.installments}
                    onChange={v => update("installments", v)}
                    totalAmount={plan.totalAmount}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "16px 28px", borderTop: "1px solid #f1f5f9",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <button
            onClick={() => step === 1 ? onClose() : setStep(1)}
            style={{
              background: "none", border: "1.5px solid #e5e7eb", borderRadius: 10,
              padding: "10px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600,
              color: "#374151",
            }}
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            {step === 1 && (
              <button
                onClick={() => { onSave({ ...plan, status: "draft" }); }}
                disabled={!isValid}
                style={{
                  background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: 10,
                  padding: "10px 20px", cursor: isValid ? "pointer" : "not-allowed",
                  fontSize: 13, fontWeight: 600, color: "#374151",
                  opacity: isValid ? 1 : 0.5,
                }}
              >Save as Draft</button>
            )}
            <button
              onClick={() => {
                if (step === 1) { if (isValid) setStep(2); }
                else { onSave({ ...plan, status: "active" }); }
              }}
              disabled={!isValid}
              style={{
                background: isValid ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "#d1d5db",
                border: "none", borderRadius: 10, padding: "10px 24px",
                cursor: isValid ? "pointer" : "not-allowed",
                fontSize: 13, fontWeight: 700, color: "#fff",
                boxShadow: isValid ? "0 4px 14px #6366f140" : "none",
                transition: "all 0.2s",
              }}
            >
              {step === 1 ? "Next: Amount & Schedule →" : "✓ Save Fee Plan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Main Component ─────────────────────────────────────────────────────────────

export default function InstallmentPlansTab() {
  const [plans, setPlans] = useState(SEED_PLANS);
  const [showModal, setShowModal] = useState(false);
  const [editPlan, setEditPlan] = useState(null);

  // Filters
  const [filterFeeType, setFilterFeeType] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterYear, setFilterYear] = useState("2025-26");
  const [searchQuery, setSearchQuery] = useState("");

  const handleSave = (plan) => {
    setPlans(p => {
      const idx = p.findIndex(x => x.id === plan.id);
      if (idx >= 0) {
        const copy = [...p]; copy[idx] = plan; return copy;
      }
      return [...p, plan];
    });
    setShowModal(false);
    setEditPlan(null);
  };

  const handleDelete = (id) => {
    if (confirm("Delete this fee plan?")) {
      setPlans(p => p.filter(x => x.id !== id));
    }
  };

  const handleDuplicate = (plan) => {
    const newPlan = { ...plan, id: Date.now(), name: plan.name + " (Copy)", status: "draft" };
    setPlans(p => [...p, newPlan]);
  };

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      if (filterFeeType !== "all" && p.feeType !== filterFeeType) return false;
      if (filterClass !== "all" && !p.classes.includes(filterClass)) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (filterYear !== "all" && p.academicYear !== filterYear) return false;
      if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [plans, filterFeeType, filterClass, filterStatus, filterYear, searchQuery]);

  // Stats
  const activeCount = plans.filter(p => p.status === "active").length;
  const draftCount = plans.filter(p => p.status === "draft").length;
  const totalFeeTypes = new Set(plans.map(p => p.feeType)).size;

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-300">
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            💰 Fee Plans
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create and manage fee structures. These plans are assigned to students during admission.
          </p>
        </div>
        <button
          onClick={() => { setEditPlan(null); setShowModal(true); }}
          className="flex items-center gap-2 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90 transition cursor-pointer shadow-md"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Create Fee Plan
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-4">
          <div className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Active Plans</div>
          <div className="text-2xl font-extrabold text-indigo-700 mt-1">{activeCount}</div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-100 rounded-xl p-4">
          <div className="text-xs font-bold text-amber-500 uppercase tracking-wide">Drafts</div>
          <div className="text-2xl font-extrabold text-amber-700 mt-1">{draftCount}</div>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-xl p-4">
          <div className="text-xs font-bold text-emerald-500 uppercase tracking-wide">Fee Types Used</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-1">{totalFeeTypes}</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 bg-gray-50 border border-gray-100 p-3 rounded-lg flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search plans..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md outline-none focus:border-blue-500"
          />
        </div>

        <select value={filterFeeType} onChange={e => setFilterFeeType(e.target.value)}
          className="rounded-md border border-gray-200 py-1.5 px-2 text-xs font-medium outline-none focus:border-blue-500 cursor-pointer">
          <option value="all">All Fee Types</option>
          {FEE_TYPES.map(f => <option key={f.id} value={f.id}>{f.icon} {f.label}</option>)}
        </select>

        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
          className="rounded-md border border-gray-200 py-1.5 px-2 text-xs font-medium outline-none focus:border-blue-500 cursor-pointer">
          <option value="all">All Classes</option>
          {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-md border border-gray-200 py-1.5 px-2 text-xs font-medium outline-none focus:border-blue-500 cursor-pointer">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
        </select>

        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="rounded-md border border-gray-200 py-1.5 px-2 text-xs font-medium outline-none focus:border-blue-500 cursor-pointer">
          <option value="all">All Years</option>
          <option value="2024-25">2024-25</option>
          <option value="2025-26">2025-26</option>
          <option value="2026-27">2026-27</option>
        </select>
      </div>

      {/* Plans Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse bg-white">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fee Plan</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Fee Type</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Classes</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-sm">
            {filteredPlans.length > 0 ? filteredPlans.map((plan) => {
              const ft = FEE_TYPES.find(f => f.id === plan.feeType);
              return (
                <tr key={plan.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-900">{plan.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {plan.isMandatory ? "Mandatory" : "Optional"} · {plan.academicYear}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {ft && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold"
                        style={{ background: ft.color + "15", color: ft.color, border: `1px solid ${ft.color}30` }}>
                        {ft.icon} {ft.label}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 text-xs">
                    {plan.classes.length <= 3
                      ? plan.classes.join(", ")
                      : `${plan.classes.length} classes`
                    }
                  </td>
                  <td className="px-5 py-3.5 font-bold text-gray-800">
                    ₹{parseFloat(plan.totalAmount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-xs font-semibold">
                      {plan.installmentPreset}
                      <span className="text-blue-400">({plan.installments?.length || 0}x)</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      plan.status === 'active'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${plan.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                      {plan.status === 'active' ? 'Active' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditPlan(plan); setShowModal(true); }}
                        className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer text-xs px-2 py-1 rounded hover:bg-blue-50 transition">Edit</button>
                      <button onClick={() => handleDuplicate(plan)}
                        className="text-gray-500 hover:text-gray-700 font-medium cursor-pointer text-xs px-2 py-1 rounded hover:bg-gray-100 transition">Copy</button>
                      <button onClick={() => handleDelete(plan.id)}
                        className="text-red-500 hover:text-red-700 font-medium cursor-pointer text-xs px-2 py-1 rounded hover:bg-red-50 transition">Delete</button>
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="text-gray-400 text-lg mb-2">📋</div>
                  <span className="text-gray-500 font-medium">No fee plans match your filters.</span>
                  <div className="mt-2">
                    <button onClick={() => { setEditPlan(null); setShowModal(true); }}
                      className="text-blue-600 font-semibold text-sm hover:underline cursor-pointer">
                      + Create your first fee plan
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Summary */}
      {filteredPlans.length > 0 && (
        <div className="text-xs text-gray-400 text-right">
          Showing {filteredPlans.length} of {plans.length} fee plans
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <PlanCreatorModal
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditPlan(null); }}
          editPlan={editPlan}
        />
      )}
    </div>
  );
}
