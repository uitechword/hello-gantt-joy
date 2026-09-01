import { useState, useCallback, useRef } from "react";
import { Sparkles, X, Upload, Loader2, CheckCircle2, Circle, FileText, AlertTriangle, Info, Users, Milestone, Link2, Clock } from "lucide-react";

import { extractTextFromFile } from "@/lib/document-parser";
import { AIProjectPlan, totalMilestones, totalDependencies, estimateTotalDurationDays } from "@/lib/ai-plan";
import { useToast } from "@/hooks/use-toast-simple";

interface Props {
  open: boolean;
  onClose: () => void;
  onLoadPlan: (plan: AIProjectPlan) => void;
}

type StepStatus = "pending" | "active" | "done" | "error";
interface Step { key: string; label: string; status: StepStatus }

const INITIAL_STEPS: Step[] = [
  { key: "read", label: "Reading document", status: "pending" },
  { key: "analyze", label: "Analyzing requirements", status: "pending" },
  { key: "wbs", label: "Creating work breakdown structure", status: "pending" },
  { key: "deps", label: "Generating dependencies", status: "pending" },
  { key: "durations", label: "Estimating durations", status: "pending" },
  { key: "gantt", label: "Preparing Gantt data", status: "pending" },
];

export function AIPlannerPanel({ open, onClose, onLoadPlan }: Props) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [plan, setPlan] = useState<AIProjectPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setStep = (key: string, status: StepStatus) => {
    setSteps(prev => prev.map(s => s.key === key ? { ...s, status } : s));
  };

  const reset = () => {
    setSteps(INITIAL_STEPS);
    setPlan(null);
    setError(null);
  };

  const handleGenerate = useCallback(async () => {
    if (!file) {
      toast({ title: "Upload required", description: "Please upload a BRD file first." });
      return;
    }
    setLoading(true);
    reset();
    try {
      setStep("read", "active");
      const text = await extractTextFromFile(file);
      if (!text.trim()) throw new Error("Document appears empty or unreadable.");
      setStep("read", "done");

      setStep("analyze", "active");
      await new Promise(r => setTimeout(r, 300));
      setStep("analyze", "done");
      setStep("wbs", "active");

      const response = await fetch("/api/public/ai-plan-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText: text, prompt }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "AI request failed");
      if (data?.error) throw new Error(data.error);
      const generatedPlan: AIProjectPlan = data.plan;
      if (!generatedPlan?.tasks?.length) throw new Error("AI returned an empty plan.");

      setStep("wbs", "done");
      setStep("deps", "done");
      setStep("durations", "done");
      setStep("gantt", "active");
      await new Promise(r => setTimeout(r, 200));
      setStep("gantt", "done");

      setPlan(generatedPlan);
    } catch (e: any) {
      const msg = e?.message || String(e);
      setError(msg);
      setSteps(prev => prev.map(s => s.status === "active" ? { ...s, status: "error" } : s));
      toast({ title: "Generation failed", description: msg });
    } finally {
      setLoading(false);
    }
  }, [file, prompt, toast]);

  const handleLoad = () => {
    if (!plan) return;
    onLoadPlan(plan);
    toast({ title: "Plan loaded", description: `${plan.tasks.length} tasks added to the Gantt.` });
    onClose();
    setFile(null);
    setPrompt("");
    reset();
  };

  if (!open) return null;

  return (
    <>
      <div className="ai-panel-overlay" onClick={onClose} />
      <aside className="ai-panel" role="dialog" aria-label="AI Project Planner">
        <header className="ai-panel-header">
          <div className="ai-panel-title">
            <div className="ai-panel-icon"><Sparkles size={18} /></div>
            <div>
              <h2>AI Project Planner</h2>
              <p>Turn a BRD into a full project plan</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="ai-panel-body">
          {!plan && (
            <>
              <section className="ai-section">
                <label className="ai-label">1. Upload Business Requirement Document</label>
                <div
                  className={`ai-dropzone ${file ? "has-file" : ""}`}
                  onClick={() => inputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); }}
                  onDrop={e => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) setFile(f);
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    hidden
                    onChange={e => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <>
                      <FileText size={22} />
                      <div>
                        <div className="ai-file-name">{file.name}</div>
                        <div className="ai-file-meta">{(file.size / 1024).toFixed(1)} KB — click to change</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Upload size={22} />
                      <div>
                        <div className="ai-file-name">Click to upload or drag & drop</div>
                        <div className="ai-file-meta">PDF, DOCX, TXT, MD</div>
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="ai-section">
                <label className="ai-label">2. Optional instructions</label>
                <textarea
                  className="ai-textarea"
                  rows={3}
                  placeholder='e.g. "Generate a detailed project plan. Maximum task duration is 5 working days."'
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                />
              </section>

              <button
                className="btn btn-primary ai-generate-btn"
                onClick={handleGenerate}
                disabled={!file || loading}
              >
                {loading ? <><Loader2 size={16} className="spin" /> Generating…</> : <><Sparkles size={16} /> Generate Plan</>}
              </button>

              {(loading || steps.some(s => s.status !== "pending")) && (
                <section className="ai-section">
                  <label className="ai-label">Progress</label>
                  <ol className="ai-timeline">
                    {steps.map(s => (
                      <li key={s.key} className={`ai-timeline-item status-${s.status}`}>
                        <span className="ai-timeline-icon">
                          {s.status === "done" && <CheckCircle2 size={16} />}
                          {s.status === "active" && <Loader2 size={16} className="spin" />}
                          {s.status === "pending" && <Circle size={16} />}
                          {s.status === "error" && <AlertTriangle size={16} />}
                        </span>
                        <span>{s.label}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {error && (
                <div className="ai-alert ai-alert-error">
                  <AlertTriangle size={16} /> {error}
                </div>
              )}
            </>
          )}

          {plan && (
            <>
              <div className="ai-project-name">
                <Sparkles size={16} />
                <h3>{plan.projectName}</h3>
              </div>
              {plan.summary && <p className="ai-summary-text">{plan.summary}</p>}

              <div className="ai-summary-grid">
                <SummaryCard icon={<FileText size={16} />} label="Tasks" value={plan.tasks.length} />
                <SummaryCard icon={<Milestone size={16} />} label="Milestones" value={totalMilestones(plan)} />
                <SummaryCard icon={<Link2 size={16} />} label="Dependencies" value={totalDependencies(plan)} />
                <SummaryCard icon={<Clock size={16} />} label="Est. Days" value={estimateTotalDurationDays(plan)} />
              </div>

              {plan.resourceRoles?.length > 0 && (
                <section className="ai-section">
                  <label className="ai-label"><Users size={14} /> Suggested Roles</label>
                  <div className="ai-chip-row">
                    {plan.resourceRoles.map((r, i) => (
                      <span key={i} className="ai-chip">{r}</span>
                    ))}
                  </div>
                </section>
              )}

              {plan.assumptions?.length > 0 && (
                <section className="ai-section">
                  <label className="ai-label"><Info size={14} /> Assumptions</label>
                  <ul className="ai-list">
                    {plan.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </section>
              )}

              {plan.warnings?.length > 0 && (
                <section className="ai-section">
                  <label className="ai-label"><AlertTriangle size={14} /> Warnings</label>
                  <ul className="ai-list ai-list-warn">
                    {plan.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </section>
              )}

              <div className="ai-action-row">
                <button className="btn btn-ghost" onClick={reset}>Discard</button>
                <button className="btn btn-primary" onClick={handleLoad}>Load into Gantt</button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="ai-summary-card">
      <div className="ai-summary-icon">{icon}</div>
      <div className="ai-summary-value">{value}</div>
      <div className="ai-summary-label">{label}</div>
    </div>
  );
}
