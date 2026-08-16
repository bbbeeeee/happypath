import frozenResultJson from "../data/detour/seward-park-shade-result.json";
import type { RepresentativeShadeScenarioResult } from "./representativeShadeScenario";

/** Checked-in planner result. Regenerate it with the scenario generator script. */
export const frozenRepresentativeShadeScenario = frozenResultJson as unknown as RepresentativeShadeScenarioResult;
