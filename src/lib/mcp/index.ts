import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMatchesTool from "./tools/list-matches";

// Emissor do Auth do próprio projeto (Supabase auto-hospedado): deriva de VITE_SUPABASE_URL.
// Sem a URL, cai no formato antigo *.supabase.co. Valores embutidos na compilação.
const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";
const issuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : `https://${projectRef}.supabase.co/auth/v1`;

export default defineMcp({
  name: "arena-mcp",
  title: "Arena MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Arena sports companion app. Use `list_matches` to read the current match board (live scores, finished games, overtime).",
  auth: auth.oauth.issuer({
    issuer,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMatchesTool],
});
