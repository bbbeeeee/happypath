import { useEffect, useRef, useState } from "react";
import { Send, X, Sparkles } from "lucide-react";

// Coordinates the assistant should treat as "here" when the user says "this
// area". The map is a fixed render of NYC, so City Hall is a reasonable anchor
// for the demo; a future version can derive this from the viewport center.
const DEFAULT_LOCATION = { latitude: 40.7128, longitude: -74.006 };

interface Message {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
}

const SUGGESTIONS = [
  "What's going on around here right now?",
  "Any noise complaints nearby this week?",
  "What community resources are near City Hall?",
  "Is it a good afternoon to walk around downtown?",
];

// Labels for the tool names the server reports back.
const TOOL_LABELS: Record<string, string> = {
  nyc_311: "NYC 311",
  nyc_weather: "Weather",
  web_search: "Web",
};

interface CityOSProps {
  onClose: () => void;
}

export function CityOS({ onClose }: CityOSProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the newest message in view as the transcript grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || pending) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setDraft("");
    setPending(true);
    setError(null);

    try {
      // Attach the map location so "here" resolves without the user naming a place.
      const payload = nextMessages.map((message, index) =>
        index === nextMessages.length - 1
          ? {
              role: message.role,
              content:
                `${message.content}\n\n<map_location>` +
                `latitude: ${DEFAULT_LOCATION.latitude}, ` +
                `longitude: ${DEFAULT_LOCATION.longitude}` +
                `</map_location>`,
            }
          : { role: message.role, content: message.content }
      );

      const response = await fetch("/api/cityos/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: payload }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);

      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.text, toolsUsed: data.toolsUsed },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter makes a new line.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(draft);
    }
  };

  return (
    <aside className="cityos" aria-label="City OS assistant">
      <header className="cityos-titlebar">
        <span className="cityos-app-icon" aria-hidden="true">
          <Sparkles size={14} />
        </span>
        <div className="cityos-window-title">
          <h2>City OS Assistant</h2>
          <span>New York City</span>
        </div>
        <button
          className="cityos-close"
          onClick={onClose}
          title="Close City OS"
          aria-label="Close City OS"
        >
          <X size={14} />
        </button>
      </header>

      <div className="cityos-toolbar" aria-label="Live data status">
        <span className="cityos-online-dot" aria-hidden="true" />
        <strong>Live</strong>
        <span>NYC 311</span>
        <span className="cityos-toolbar-divider" aria-hidden="true" />
        <span>Weather</span>
        <span className="cityos-toolbar-divider" aria-hidden="true" />
        <span>Web</span>
      </div>

      <div
        className="cityos-transcript"
        ref={scrollRef}
        aria-live="polite"
        aria-busy={pending}
      >
        {messages.length === 0 && (
          <div className="cityos-intro">
            <span className="cityos-note-label">CITY NOTE · LIVE</span>
            <h3>What should we look up?</h3>
            <p>
              Ask about services, civic conditions, businesses, or community
              resources anywhere in the city.
            </p>
            <div className="cityos-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} onClick={() => send(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`cityos-message cityos-${message.role}`}>
            <span className="cityos-message-role">
              {message.role === "user" ? "You" : "City OS"}
            </span>
            <div className="cityos-bubble">{message.content}</div>
            {message.toolsUsed && message.toolsUsed.length > 0 && (
              <div className="cityos-sources">
                {[...new Set(message.toolsUsed)].map((tool) => (
                  <span key={tool} className="cityos-source">
                    {TOOL_LABELS[tool] ?? tool}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {pending && (
          <div className="cityos-message cityos-assistant">
            <div className="cityos-bubble cityos-thinking">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {error && <div className="cityos-error">{error}</div>}
      </div>

      {/* Legal-pad composer: ruled yellow paper with a red margin rule. */}
      <div className="cityos-composer">
        <label htmlFor="cityos-draft">Ask City OS</label>
        <textarea
          id="cityos-draft"
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask City OS…"
          rows={3}
          disabled={pending}
        />
        <button
          className="cityos-send"
          onClick={() => send(draft)}
          disabled={pending || draft.trim().length === 0}
          title="Send"
        >
          <Send size={13} />
          <span>Send</span>
        </button>
        <span className="cityos-key-hint">Enter to send · Shift+Enter for a new line</span>
      </div>
    </aside>
  );
}
