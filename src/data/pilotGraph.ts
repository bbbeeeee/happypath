import type { GraphEdge, PilotGraph } from "../types";

const WEST = -74.0045;
const SOUTH = 40.7265;
const COLS = 7;
const ROWS = 6;
const LNG_STEP = 0.00235;
const LAT_STEP = 0.00165;

const avenueNames = [
  "Sixth Avenue",
  "MacDougal Street",
  "Sullivan Street",
  "Thompson Street",
  "West Broadway",
  "Greene Street",
  "Broadway",
];
const streetNames = [
  "Houston Street",
  "Prince Street",
  "Spring Street",
  "Broome Street",
  "Grand Street",
  "Canal Street",
];

const nodes = Array.from({ length: ROWS * COLS }, (_, index) => {
  const row = Math.floor(index / COLS);
  const col = index % COLS;
  return {
    id: `${row}-${col}`,
    name: `${streetNames[row]} & ${avenueNames[col]}`,
    coordinate: [WEST + col * LNG_STEP, SOUTH + row * LAT_STEP] as [number, number],
  };
});

function meters(a: [number, number], b: [number, number]) {
  const latMeters = (b[1] - a[1]) * 111_111;
  const lngMeters = (b[0] - a[0]) * 84_200;
  return Math.hypot(latMeters, lngMeters);
}

const edges: GraphEdge[] = [];
const nodeAt = (row: number, col: number) => nodes[row * COLS + col];

for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    const current = nodeAt(row, col);
    if (col + 1 < COLS) {
      const next = nodeAt(row, col + 1);
      edges.push({
        id: `h-${row}-${col}`,
        from: current.id,
        to: next.id,
        street: streetNames[row],
        distanceMeters: meters(current.coordinate, next.coordinate),
        orientationDegrees: 90,
        canyonFactor: 0.3 + ((row * 3 + col) % 6) * 0.11,
        treeFactor: 0.12 + ((row + col * 2) % 5) * 0.08,
        source: "modeled-demo",
      });
    }
    if (row + 1 < ROWS) {
      const next = nodeAt(row + 1, col);
      edges.push({
        id: `v-${row}-${col}`,
        from: current.id,
        to: next.id,
        street: avenueNames[col],
        distanceMeters: meters(current.coordinate, next.coordinate),
        orientationDegrees: 0,
        canyonFactor: 0.22 + ((row + col * 3) % 7) * 0.1,
        treeFactor: 0.08 + ((row * 2 + col) % 5) * 0.07,
        source: "modeled-demo",
      });
    }
  }
}

export const pilotGraph: PilotGraph = { nodes, edges };
export const defaultOrigin = "0-0";
export const defaultDestination = "5-6";
