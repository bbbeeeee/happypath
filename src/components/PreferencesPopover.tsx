import { useEffect, useId, useRef, useState } from "react";
import { BenchIcon, CloseIcon, DropletIcon, LeafIcon, RestroomIcon, SunIcon, TuneIcon } from "./Icons";
import {
  DEFAULT_USER_PREFERENCES,
  MAX_WALKING_NOTE_CHARACTERS,
  normalizeWalkingNote,
  type PreferencePriority,
  type UserPreferences,
} from "../preferences";

const PREFERENCE_OPTIONS: { value: PreferencePriority; label: string; icon: typeof SunIcon }[] = [
  { value: "shade", label: "Less direct sun", icon: SunIcon },
  { value: "greenery", label: "Greener streets", icon: LeafIcon },
  { value: "rest", label: "Places to rest", icon: BenchIcon },
  { value: "water", label: "Water stops", icon: DropletIcon },
  { value: "restroom", label: "Restrooms", icon: RestroomIcon },
];

export function PreferencesPopover({ preferences, onSave, onReset, appliesNow }: {
  preferences: UserPreferences | null;
  onSave: (preferences: UserPreferences) => void;
  onReset: () => void;
  appliesNow: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<UserPreferences>(preferences ?? DEFAULT_USER_PREFERENCES);
  const [saved, setSaved] = useState(false);
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hasPreferences = preferences !== null;

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const togglePriority = (priority: PreferencePriority) => {
    const preferredPriorities = draft.preferredPriorities.includes(priority)
      ? draft.preferredPriorities.filter((item) => item !== priority)
      : [...draft.preferredPriorities, priority];
    setDraft({ ...draft, preferredPriorities });
  };

  return <>
    <button
      ref={triggerRef}
      type="button"
      className={`preferences-trigger ${hasPreferences ? "has-preferences" : ""}`}
      aria-label="Walking preferences"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={dialogId}
      title="Walking preferences"
      onClick={() => {
        if (open) close();
        else {
          setDraft(preferences ?? { ...DEFAULT_USER_PREFERENCES, preferredPriorities: [] });
          setSaved(false);
          setOpen(true);
        }
      }}
    ><TuneIcon />{hasPreferences && <span aria-hidden="true" />}</button>
    {open && <>
      <div className="preferences-scrim" aria-hidden="true" onMouseDown={() => close()} />
      <section className="preferences-popover" id={dialogId} role="dialog" aria-labelledby={`${dialogId}-title`}>
        <header>
          <div><span className="eyebrow">Walk preferences</span><h2 id={`${dialogId}-title`}>Your walking defaults</h2></div>
          <button ref={closeRef} type="button" className="preferences-close" aria-label="Close walking preferences" onClick={() => close()}><CloseIcon /></button>
        </header>
        <p>Start new walks with what usually matters. Anything you ask for on a trip still takes priority.</p>
        <fieldset>
          <legend>Favor routes with</legend>
          <div className="preference-chips">
            {PREFERENCE_OPTIONS.map((option) => {
              const OptionIcon = option.icon;
              const active = draft.preferredPriorities.includes(option.value);
              return <button type="button" key={option.value} className={active ? "active" : ""} aria-pressed={active} onClick={() => togglePriority(option.value)}><OptionIcon />{option.label}</button>;
            })}
          </div>
        </fieldset>
        <fieldset className="detour-preference">
          <legend>Usual extra time</legend>
          <span>For destination walks</span>
          <div role="group" aria-label="Usual extra time for destination walks">
            {([0, 5, 10] as const).map((minutes) => <button type="button" key={minutes} className={draft.detourMinutes === minutes ? "active" : ""} aria-pressed={draft.detourMinutes === minutes} onClick={() => setDraft({ ...draft, detourMinutes: minutes })}>{minutes === 0 ? "Fastest" : `+${minutes} min`}</button>)}
          </div>
        </fieldset>
        <label className="walking-note">
          <span><strong>A note for Happy Path</strong><small>{draft.walkingNote.length} / {MAX_WALKING_NOTE_CHARACTERS}</small></span>
          <textarea
            value={draft.walkingNote}
            maxLength={MAX_WALKING_NOTE_CHARACTERS}
            rows={3}
            placeholder="I usually like leafy streets and places to pause."
            onChange={(event) => setDraft({ ...draft, walkingNote: event.target.value })}
          />
          <small>Optional · saved on this device. We’ll use route preferences we support; avoid personal details.</small>
        </label>
        <footer>
          <div><span>Only on this device.</span>{saved && <strong role="status">{appliesNow ? " Saved and applied." : " Saved for your next walk."}</strong>}</div>
          <div>{hasPreferences && <button type="button" className="preferences-reset" onClick={() => { onReset(); setDraft({ ...DEFAULT_USER_PREFERENCES, preferredPriorities: [] }); setSaved(false); }}>Reset</button>}<button type="button" className="preferences-save" onClick={() => { const next = { ...draft, walkingNote: normalizeWalkingNote(draft.walkingNote) }; setDraft(next); onSave(next); setSaved(true); }}>Save</button></div>
        </footer>
      </section>
    </>}
  </>;
}
