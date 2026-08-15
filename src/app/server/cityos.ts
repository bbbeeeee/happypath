import type { Plugin } from "vite";
import Anthropic from "@anthropic-ai/sdk";

// City OS backend, mounted on the vite dev server.
//
// This is a hackathon demo: it runs as dev-server middleware rather than a
// deployed service. The one thing it does take seriously is keeping
// ANTHROPIC_API_KEY server-side — the browser never sees it.

const MODEL = "claude-opus-5";
const NYC_LATITUDE = 40.7128;
const NYC_LONGITUDE = -74.006;

const SYSTEM_PROMPT = `You are City OS, an assistant embedded in an isometric pixel-art map of New York City.

You help New Yorkers with what is happening around them right now: city services, civic
issues, local businesses, community resources, events, and opportunities.

How to work:
- Use nyc_311 for live civic conditions at a location — noise, street conditions,
  sanitation, parking. It is the ground truth for "what is going on around here".
- Use nyc_weather for current conditions.
- Use web_search for anything the tools above don't cover: businesses, events,
  programs, opportunities, transit, hours, prices. Search when the answer depends
  on current information rather than answering from memory.
- The user is looking at a map. When they ask about "here" or "this area" without
  naming a place, use the map_location provided in their message.

Answer in plain prose, a few sentences. Lead with the answer, then the supporting
detail. Name the specific street, business, or agency rather than speaking in
generalities, and say plainly when you don't have data for something.`;

interface ToolResult {
  content: string;
  isError?: boolean;
}

// Live 311 service requests near a point, from NYC Open Data. No API key needed
// at demo request volumes.
async function nyc311(input: {
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  complaint_type?: string;
}): Promise<ToolResult> {
  const lat = input.latitude ?? NYC_LATITUDE;
  const lon = input.longitude ?? NYC_LONGITUDE;
  const radius = Math.min(input.radius_meters ?? 800, 5000);

  const clauses = [`within_circle(location,${lat},${lon},${radius})`];
  if (input.complaint_type) {
    // Escape single quotes so a quote in the model's argument can't break out
    // of the SoQL string literal.
    const safe = input.complaint_type.replace(/'/g, "''");
    clauses.push(`upper(complaint_type) like upper('%${safe}%')`);
  }

  const url =
    "https://data.cityofnewyork.us/resource/erm2-nwe9.json" +
    `?$limit=40&$order=created_date DESC&$where=${encodeURIComponent(clauses.join(" AND "))}`;

  const response = await fetch(url);
  if (!response.ok) {
    return { content: `311 API returned ${response.status}`, isError: true };
  }

  const rows = (await response.json()) as Record<string, string>[];
  if (rows.length === 0) {
    return { content: "No 311 requests found in that area." };
  }

  const summary = rows.map((r) => ({
    type: r.complaint_type,
    detail: r.descriptor,
    address: r.incident_address ?? r.street_name,
    status: r.status,
    created: r.created_date,
    agency: r.agency,
  }));

  // Counts by type help the model see the shape of the area at a glance.
  const byType: Record<string, number> = {};
  for (const r of rows) byType[r.complaint_type] = (byType[r.complaint_type] ?? 0) + 1;

  return {
    content: JSON.stringify(
      { total: rows.length, radius_meters: radius, counts_by_type: byType, requests: summary },
      null,
      2
    ),
  };
}

async function nycWeather(input: {
  latitude?: number;
  longitude?: number;
}): Promise<ToolResult> {
  const lat = input.latitude ?? NYC_LATITUDE;
  const lon = input.longitude ?? NYC_LONGITUDE;
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&forecast_days=3&temperature_unit=fahrenheit&timezone=America%2FNew_York";

  const response = await fetch(url);
  if (!response.ok) {
    return { content: `Weather API returned ${response.status}`, isError: true };
  }
  return { content: JSON.stringify(await response.json(), null, 2) };
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "nyc_311",
    description:
      "Search live NYC 311 service requests near a coordinate. Call this when the user asks " +
      "what is happening in an area, about noise, street or sidewalk conditions, sanitation, " +
      "parking, or how a neighborhood is doing right now. Returns the most recent requests " +
      "plus counts by complaint type.",
    input_schema: {
      type: "object",
      properties: {
        latitude: { type: "number", description: "Latitude of the point of interest." },
        longitude: { type: "number", description: "Longitude of the point of interest." },
        radius_meters: {
          type: "number",
          description: "Search radius in meters. Defaults to 800, max 5000.",
        },
        complaint_type: {
          type: "string",
          description:
            "Optional filter, matched as a substring of the 311 complaint type " +
            "(e.g. 'Noise', 'Illegal Parking', 'Street Condition').",
        },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "nyc_weather",
    description:
      "Get current conditions and a 3-day forecast for a point in NYC. Call this when weather " +
      "affects the answer — outdoor plans, events, comfort of a walking route.",
    input_schema: {
      type: "object",
      properties: {
        latitude: { type: "number", description: "Latitude of the point of interest." },
        longitude: { type: "number", description: "Longitude of the point of interest." },
      },
      required: ["latitude", "longitude"],
    },
  },
];

async function runTool(name: string, input: unknown): Promise<ToolResult> {
  try {
    switch (name) {
      case "nyc_311":
        return await nyc311(input as Parameters<typeof nyc311>[0]);
      case "nyc_weather":
        return await nycWeather(input as Parameters<typeof nycWeather>[0]);
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (error) {
    return { content: `Tool ${name} failed: ${String(error)}`, isError: true };
  }
}

// Cap the agentic loop so a demo can't spin.
const MAX_TURNS = 8;

async function chat(
  client: Anthropic,
  messages: Anthropic.MessageParam[]
): Promise<{ text: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      tools: [
        ...TOOLS,
        { type: "web_search_20260209", name: "web_search" } as unknown as Anthropic.Tool,
      ],
      messages,
    });

    if (response.stop_reason === "refusal") {
      return { text: "I can't help with that one.", toolsUsed };
    }

    // A server-side tool hit its iteration limit — re-send to let it continue.
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (toolUses.length === 0) {
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return { text, toolsUsed };
    }

    messages.push({ role: "assistant", content: response.content });

    // Run the requested tools in parallel, then return every result in one
    // user message — splitting them teaches the model to stop batching calls.
    const results = await Promise.all(
      toolUses.map(async (toolUse) => {
        toolsUsed.push(toolUse.name);
        const result = await runTool(toolUse.name, toolUse.input);
        return {
          type: "tool_result" as const,
          tool_use_id: toolUse.id,
          content: result.content,
          is_error: result.isError,
        };
      })
    );

    messages.push({ role: "user", content: results });
  }

  return {
    text: "I hit my step limit working on that. Try narrowing the question.",
    toolsUsed,
  };
}

function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function cityOsPlugin(): Plugin {
  return {
    name: "city-os",
    configureServer(server) {
      server.middlewares.use("/api/cityos/chat", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "POST only" }));
          return;
        }

        res.setHeader("content-type", "application/json");

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          res.statusCode = 503;
          res.end(
            JSON.stringify({
              error:
                "City OS needs an API key. Set ANTHROPIC_API_KEY in .env at the repo root and restart the dev server.",
            })
          );
          return;
        }

        try {
          const { messages } = JSON.parse(await readBody(req)) as {
            messages: Anthropic.MessageParam[];
          };

          const client = new Anthropic({ apiKey });
          const result = await chat(client, messages);
          res.end(JSON.stringify(result));
        } catch (error) {
          console.error("[city-os]", error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(error) }));
        }
      });
    },
  };
}
