import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { join } from "node:path";
import { readdir, stat } from "node:fs/promises";
import { getComposeDir } from "@/lib/panel-constants";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const compose = getComposeDir();
  const demoDir = join(compose, "cs2-data", "game", "csgo", "MatchZy", "Demos");

  try {
    const files = await readdir(demoDir);
    const demos = await Promise.all(
      files
        .filter((f) => f.endsWith(".dem"))
        .map(async (f) => {
          const s = await stat(join(demoDir, f));
          return {
            name: f,
            size: s.size,
            atime: s.atime,
            mtime: s.mtime,
            ctime: s.ctime,
          };
        })
    );

    return NextResponse.json({ demos: demos.sort((a, b) => b.mtime.getTime() - a.mtime.getTime()) });
  } catch (e) {
    return NextResponse.json({ demos: [], error: "No demos found or directory missing" });
  }
}
