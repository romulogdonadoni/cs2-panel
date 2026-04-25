import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { join } from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { getComposeDir } from "@/lib/panel-constants";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { filename } = await params;
  if (!filename.endsWith(".dem")) {
    return NextResponse.json({ error: "invalid file type" }, { status: 400 });
  }

  const compose = getComposeDir();
  const filePath = join(compose, "cs2-data", "game", "csgo", "MatchZy", "Demos", filename);

  try {
    const s = await stat(filePath);
    const stream = createReadStream(filePath);
    
    // @ts-ignore
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": s.size.toString(),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }
}
