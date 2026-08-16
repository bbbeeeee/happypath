import { FormEvent, useState } from "react";
import {
  MAX_ROUTE_FEEDBACK_CHARACTERS,
  ROUTE_FEEDBACK_CATEGORY_LABELS,
  ROUTE_FEEDBACK_SENTIMENT_LABELS,
  type RouteFeedback,
  type RouteFeedbackCategory,
  type RouteFeedbackSentiment,
} from "../routeActivity";

export function RouteFeedbackCard({ feedback, persisted, onSave, onRemove }: {
  feedback: readonly RouteFeedback[];
  persisted: boolean;
  onSave: (input: { sentiment: RouteFeedbackSentiment; category: RouteFeedbackCategory | null; body: string }) => void;
  onRemove: (feedbackId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sentiment, setSentiment] = useState<RouteFeedbackSentiment>("general");
  const [category, setCategory] = useState<RouteFeedbackCategory | null>(null);
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    onSave({ sentiment, category, body });
    setBody("");
    setSaved(true);
  };

  return <section className={`route-feedback-card ${open ? "open" : ""}`}>
    <button type="button" className="result-tool route-feedback-toggle" aria-expanded={open} onClick={() => { setOpen((value) => !value); setSaved(false); }}>
      <span><strong>{feedback.length ? `${feedback.length} route ${feedback.length === 1 ? "note" : "notes"}` : "Add a route note"}</strong><small>{persisted ? "Private to this browser" : "Available for this session"}</small></span>
      <span aria-hidden="true">{open ? "−" : "+"}</span>
    </button>
    {open && <div className="route-feedback-form-wrap">
      <div className="route-feedback-heading"><span className="eyebrow">Your experience</span><h2>Leave a note on this route</h2><p>Share what worked or what planners should look at. No account needed.</p></div>
      <form onSubmit={submit}>
        <fieldset><legend>How did it feel?</legend><div className="feedback-choice-row">{(Object.keys(ROUTE_FEEDBACK_SENTIMENT_LABELS) as RouteFeedbackSentiment[]).map((value) => <button type="button" key={value} className={sentiment === value ? "selected" : ""} aria-pressed={sentiment === value} onClick={() => setSentiment(value)}>{ROUTE_FEEDBACK_SENTIMENT_LABELS[value]}</button>)}</div></fieldset>
        <fieldset><legend>What is it about? <span>Optional</span></legend><div className="feedback-choice-row categories">{(Object.keys(ROUTE_FEEDBACK_CATEGORY_LABELS) as RouteFeedbackCategory[]).map((value) => <button type="button" key={value} className={category === value ? "selected" : ""} aria-pressed={category === value} onClick={() => setCategory(category === value ? null : value)}>{ROUTE_FEEDBACK_CATEGORY_LABELS[value]}</button>)}</div></fieldset>
        <label className="feedback-note"><span><strong>What should planners know?</strong><small>{body.length}/{MAX_ROUTE_FEEDBACK_CHARACTERS}</small></span><textarea value={body} maxLength={MAX_ROUTE_FEEDBACK_CHARACTERS} onChange={(event) => { setBody(event.target.value); setSaved(false); }} placeholder="The crossing felt long, but this side stayed shaded…" rows={3} /></label>
        <button type="submit" className="feedback-save" disabled={!body.trim()}>Save note</button>
        <p className="feedback-save-state" role="status" aria-live="polite">{saved ? (persisted ? "Saved on this device." : "Saved for this session; browser storage is unavailable.") : "Notes stay on this device and are not sent to NYC."}</p>
      </form>
      {feedback.length > 0 && <div className="saved-route-notes"><span className="eyebrow">Saved here</span>{feedback.slice(0, 3).map((item) => <article key={item.id}><div><strong>{ROUTE_FEEDBACK_SENTIMENT_LABELS[item.sentiment]}{item.category ? ` · ${ROUTE_FEEDBACK_CATEGORY_LABELS[item.category]}` : ""}</strong><button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove note: ${item.body}`}>Remove</button></div><p>{item.body}</p></article>)}</div>}
    </div>}
  </section>;
}
