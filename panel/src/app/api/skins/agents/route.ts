import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { savePlayerAgents, loadPlayerAgents } from "@/lib/weaponpaints-db";

/**
 * POST /api/skins/agents
 * Body: { agent_ct?: string | null, agent_t?: string | null }
 * def_index do agente CT e/ou T (ex: "4619")
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const steamid = session.steamid64;

  // Carrega agentes existentes para preservar o lado que não está sendo alterado
  const current = await loadPlayerAgents(steamid);

  const agent_ct = "agent_ct" in body
    ? (body.agent_ct as string | null)
    : (current?.agent_ct ?? null);

  const agent_t = "agent_t" in body
    ? (body.agent_t as string | null)
    : (current?.agent_t ?? null);

  await savePlayerAgents(steamid, agent_ct, agent_t);
  return NextResponse.json({ ok: true, agent_ct, agent_t });
}

/**
 * DELETE /api/skins/agents
 * Body: { side: "ct" | "t" | "both" }
 */
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const steamid = session.steamid64;
  const side = body.side as string;
  const current = await loadPlayerAgents(steamid);

  const agent_ct = side === "ct" || side === "both" ? null : (current?.agent_ct ?? null);
  const agent_t  = side === "t"  || side === "both" ? null : (current?.agent_t  ?? null);

  await savePlayerAgents(steamid, agent_ct, agent_t);
  return NextResponse.json({ ok: true });
}
