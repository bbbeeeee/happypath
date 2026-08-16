import { describe, expect, it, vi } from "vitest";
import { fetchPermits } from "../scripts/ingest-events.mjs";

describe("permitted event pagination", () => {
  it("fetches every page and includes events overlapping the ingest window", async () => {
    const firstPage = Array.from({ length: 5000 }, (_, index) => ({ event_id: String(index) }));
    const fetchImpl = vi.fn(async (request) => {
      const offset = Number(new URL(request).searchParams.get("$offset"));
      return new Response(JSON.stringify(offset === 0 ? firstPage : [{ event_id: "last" }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const permits = await fetchPermits("2026-08-15T00:00:00", "2026-09-15T00:00:00", fetchImpl);

    expect(permits).toHaveLength(5001);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstUrl = new URL(fetchImpl.mock.calls[0][0]);
    const secondUrl = new URL(fetchImpl.mock.calls[1][0]);
    expect(firstUrl.searchParams.get("$offset")).toBe("0");
    expect(secondUrl.searchParams.get("$offset")).toBe("5000");
    expect(firstUrl.searchParams.get("$where")).toContain("end_date_time >= '2026-08-15T00:00:00'");
    expect(firstUrl.searchParams.get("$where")).toContain("start_date_time <= '2026-09-15T00:00:00'");
  });
});
