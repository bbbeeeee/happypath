# Product and implementation lessons

## 2026-08-16 — Chat, controls, and model routing

- When chat and a dedicated field can both express intent, the explicit field wins. In particular, a populated **To** field must override a destination-free model classification while retaining needs such as rest or mapped-step avoidance.
- Enforce semantic invariants after structured model output. A destination journey with no destination is not plannable, so normalize a timed destination-free walk to a wander at the server boundary.
- With OpenRouter `provider.require_parameters: true`, every optional generation parameter can remove otherwise valid providers. Verify the exact selected model live; GPT-5.6 Luna supports the structured schema here but not `temperature`, so the unsupported parameter caused a complete model fallback.
- Example prompts are product contracts. Keep rain, loop, wander, and accessibility examples in both the prompt and deterministic regression suite so future copy changes cannot silently change route shape.
- A basemap failure must still leave a convincing, useful route experience. The checked-in fallback needs streets, route evidence, real amenity icons, selection state, and accessible interaction—not a blank placeholder.
- Prompts are not enforcement. Safety- and accessibility-relevant constraints need deterministic reconciliation after model output, even when a strict schema is used.
- Separate sources that computed a fact from sources worth consulting next. A permit or curb-ramp catalog can guide a field audit without becoming evidence for simulated cover or an unsurveyed route.
