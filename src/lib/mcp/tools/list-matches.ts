import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const matches = [
  {
    id: 1,
    league: "Brasileirão",
    home: "Flamengo",
    away: "Palmeiras",
    scoreH: 2,
    scoreA: 1,
    status: "AO VIVO",
    min: "82'",
  },
  {
    id: 2,
    league: "Champions League",
    home: "Real Madrid",
    away: "Man City",
    scoreH: 3,
    scoreA: 3,
    status: "PRORROGAÇÃO",
    min: "ET",
  },
  {
    id: 3,
    league: "Brasileirão",
    home: "Galo",
    away: "Cruzeiro",
    scoreH: 1,
    scoreA: 0,
    status: "ENC",
    min: "FT",
  },
  {
    id: 4,
    league: "NBA",
    home: "Lakers",
    away: "Celtics",
    scoreH: 102,
    scoreA: 108,
    status: "ENC",
    min: "FT",
  },
];

export default defineTool({
  name: "list_matches",
  title: "List matches",
  description:
    "Return all matches currently tracked in the Arena app (live, finished, and in overtime).",
  inputSchema: {
    league: z.string().optional().describe("Optional league filter, e.g. 'Brasileirão', 'NBA'."),
    status: z
      .enum(["AO VIVO", "PRORROGAÇÃO", "ENC"])
      .optional()
      .describe("Optional status filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ league, status }) => {
    const filtered = matches.filter(
      (m) => (!league || m.league === league) && (!status || m.status === status),
    );
    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
      structuredContent: { matches: filtered },
    };
  },
});
