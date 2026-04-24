import { NextResponse } from "next/server";
import { assessWorkshopFile } from "@/lib/workshop-assessment";

export type WorkshopGetResponse = {
  title: string;
  preview_url: string;
  description: string;
  filename: string;
  /** Tamanho do ficheiro publicado (bytes), quando a API devolve. */
  file_size: number;
  time_updated: number;
  time_created: number;
  consumer_app_id: number;
  assessment: ReturnType<typeof assessWorkshopFile>;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const raw = id.replace(/\D/g, "");
  if (!raw) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const apiKey = process.env.STEAM_WEB_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "STEAM_WEB_API_KEY não configurada no painel" },
      { status: 500 }
    );
  }

  try {
    const form = new URLSearchParams();
    form.append("itemcount", "1");
    form.append("publishedfileids[0]", raw);

    const r = await fetch(
      `https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/?key=${encodeURIComponent(apiKey)}`,
      { method: "POST", body: form }
    );

    if (!r.ok) {
      return NextResponse.json(
        { error: "Resposta inesperada da Steam" },
        { status: 502 }
      );
    }

    const j = (await r.json()) as {
      response?: { publishedfiledetails?: Array<Record<string, unknown>> };
    };
    const details = j?.response?.publishedfiledetails?.[0] as
      | (Record<string, unknown> & { result: number; publishedfileid: string })
      | undefined;

    if (!details) {
      return NextResponse.json(
        { error: "Item não encontrado", assessment: assessWorkshopFile({ result: 0, time_created: 0, time_updated: 0 }) },
        { status: 404 }
      );
    }

    if (details.result !== 1) {
      return NextResponse.json(
        {
          error: "Item inacessível",
          title: (details.title as string) || "",
          assessment: assessWorkshopFile({
            result: details.result,
            time_created: Number(details.time_created) || 0,
            time_updated: Number(details.time_updated) || 0,
            filename: String(details.filename || ""),
            banned: Number(details.banned) || 0,
          }),
        },
        { status: 404 }
      );
    }

    const timeUpdated = Number(details.time_updated) || 0;
    const timeCreated = Number(details.time_created) || 0;
    const filename = String(details.filename || "");
    const fileSize = Number((details as { file_size?: unknown }).file_size) || 0;

    const assessment = assessWorkshopFile({
      result: 1,
      banned: Number(details.banned) || 0,
      time_updated: timeUpdated,
      time_created: timeCreated,
      filename,
    });

    const body: WorkshopGetResponse = {
      title: String(details.title || ""),
      preview_url: String(details.preview_url || ""),
      description: String(details.description || ""),
      filename,
      file_size: fileSize,
      time_updated: timeUpdated,
      time_created: timeCreated,
      consumer_app_id: Number(details.consumer_app_id) || 0,
      assessment,
    };

    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      { error: "Falha ao falar com a Steam" },
      { status: 500 }
    );
  }
}
