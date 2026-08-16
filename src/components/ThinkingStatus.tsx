import { useEffect, useState } from "react";

export type ThinkingMode = "plan" | "refine" | "adjust" | "planner";

const NOTES: Record<ThinkingMode, readonly string[]> = {
  plan: ["Reading your plans…", "Tracing walkable streets…", "Checking comfort along the way…", "Mapping your path…"],
  refine: ["Keeping what matters…", "Trying a better turn…", "Rechecking your timing…"],
  adjust: ["Updating your route…", "Balancing time and comfort…", "Drawing the new path…"],
  planner: ["Reading the city layers…", "Looking for useful gaps…", "Shaping a planning sketch…"],
};

export function ThinkingStatus({ mode, compact = false }: { mode: ThinkingMode; compact?: boolean }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % NOTES[mode].length), 620);
    return () => window.clearInterval(timer);
  }, [mode]);
  return <div className={`thinking-status ${compact ? "compact" : ""}`} role="status" aria-label="Finding your path. Please wait.">
    <span className="thinking-orb" aria-hidden="true"><i /><i /><i /></span>
    <span aria-hidden="true" key={`${mode}-${index}`}>{NOTES[mode][index]}</span>
  </div>;
}
