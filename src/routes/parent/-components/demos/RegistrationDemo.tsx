import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChildProfile, RegistrationFormData } from "@/types/parent-portal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check, Save, Send, AlertCircle } from "lucide-react";

interface Props { child: ChildProfile; formData: RegistrationFormData }

export function RegistrationDemo({ child, formData }: Props) {
  const [cur, setCur] = useState(0);
  const [vals, setVals] = useState<Record<string, Record<string, string>>>(() => {
    const v: Record<string, Record<string, string>> = {};
    formData.sections.forEach(s => { const sv: Record<string, string> = {}; s.fields.forEach(f => { sv[f.id] = f.value ?? f.default_value ?? ""; }); v[s.id] = sv; });
    return v;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const sections = formData.sections;
  const section = sections[cur];
  const total = sections.length;

  const validate = () => { if (!section) return true; const e: Record<string, string> = {}; section.fields.forEach(f => { if (f.is_required && !vals[section.id]?.[f.id]?.trim()) e[f.id] = `${f.label} is required`; }); setErrors(e); return !Object.keys(e).length; };
  const handleNext = () => { if (!validate()) { toast.error("Fill required fields"); return; } setCur(p => Math.min(p + 1, total - 1)); };
  const handlePrev = () => setCur(p => Math.max(p - 1, 0));
  const handleChange = (fid: string, v: string) => { if (!section) return; setVals(p => ({ ...p, [section.id]: { ...(p[section.id] ?? {}), [fid]: v } })); if (errors[fid]) setErrors(p => { const n = { ...p }; delete n[fid]; return n; }); };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto w-full space-y-5 pb-20 lg:pb-8">
      <div><h2 className="text-lg sm:text-xl font-bold text-foreground">Registration Form</h2><p className="text-sm text-muted-foreground mt-0.5">{formData.title}</p></div>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
        {sections.map((s, i) => (<button key={s.id} onClick={() => { if (i < cur) setCur(i); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${i === cur ? "bg-primary text-primary-foreground shadow-sm" : i < cur ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 cursor-pointer" : "bg-muted text-muted-foreground"}`}>
          {i < cur ? <Check size={12} /> : <span className="w-4 h-4 rounded-full border text-center text-[10px] leading-4">{i + 1}</span>}{s.title}
        </button>))}
      </div>
      <AnimatePresence mode="wait">
        {section && (<motion.div key={section.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          <Card className="shadow-sm"><CardHeader className="pb-3"><CardTitle className="text-base">{section.title}</CardTitle>{section.description && <CardDescription className="text-xs">{section.description}</CardDescription>}</CardHeader>
            <CardContent className="space-y-4">{section.fields.map(f => (
              <div key={f.id}><label className="text-xs font-medium text-foreground mb-1.5 block">{f.label}{f.is_required && <span className="text-destructive ml-0.5">*</span>}</label>
                {f.type === "select" && f.options ? (<select value={vals[section.id]?.[f.id] ?? ""} onChange={e => handleChange(f.id, e.target.value)} className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"><option value="">Select...</option>{f.options.map(o => <option key={o} value={o}>{o}</option>)}</select>)
                : f.type === "textarea" ? (<textarea value={vals[section.id]?.[f.id] ?? ""} onChange={e => handleChange(f.id, e.target.value)} placeholder={f.placeholder} className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y" />)
                : (<Input type={f.type === "email" ? "email" : f.type === "date" ? "date" : "text"} value={vals[section.id]?.[f.id] ?? ""} onChange={e => handleChange(f.id, e.target.value)} placeholder={f.placeholder} className="h-9 text-sm" />)}
                {errors[f.id] && <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><AlertCircle size={10} />{errors[f.id]}</p>}
              </div>
            ))}</CardContent>
          </Card>
        </motion.div>)}
      </AnimatePresence>
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={handlePrev} disabled={cur === 0} className="gap-1.5 text-xs h-9"><ChevronLeft size={14} />Previous</Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => toast.success("Draft saved (demo)")} className="gap-1.5 text-xs h-9"><Save size={12} />Save Draft</Button>
          {cur < total - 1 ? (<Button onClick={handleNext} className="gap-1.5 text-xs h-9">Next<ChevronRight size={14} /></Button>) : (<Button onClick={() => toast.success("Registration submitted! (demo)")} className="gap-1.5 text-xs h-9 bg-emerald-600 hover:bg-emerald-700"><Send size={12} />Submit</Button>)}
        </div>
      </div>
    </div>
  );
}
