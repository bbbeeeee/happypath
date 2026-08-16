import { useEffect, useState } from "react";

/**
 * A quiet, reduced-motion-safe prompt hint. It types one example, pauses, then
 * replaces it with the next. The value is only decorative placeholder copy and
 * never mutates the resident's request.
 */
export function useTypingPlaceholder(examples: readonly string[]) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);

  useEffect(() => {
    if (examples.length === 0) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setCharacterCount(examples[0].length);
      return;
    }

    const example = examples[exampleIndex % examples.length];
    if (characterCount < example.length) {
      const timeout = window.setTimeout(() => setCharacterCount((value) => value + 1), 30);
      return () => window.clearTimeout(timeout);
    }

    const timeout = window.setTimeout(() => {
      setExampleIndex((value) => (value + 1) % examples.length);
      setCharacterCount(0);
    }, 2_250);
    return () => window.clearTimeout(timeout);
  }, [characterCount, exampleIndex, examples]);

  if (examples.length === 0) return "";
  return examples[exampleIndex % examples.length].slice(0, characterCount);
}
