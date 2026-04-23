import net from "node:net";

export class RconClient {
  private socket: net.Socket | null = null;
  private requestId = 1;
  private authed = false;

  constructor(private host: string, private port: number, private password: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.connect(this.port, this.host);
      this.socket.on("connect", async () => {
        try {
          await this.auth();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      this.socket.on("error", (e) => reject(e));
      this.socket.on("timeout", () => reject(new Error("RCON Timeout")));
      this.socket.setTimeout(5000);
    });
  }

  private async auth(): Promise<void> {
    const packet = this.createPacket(3, this.password);
    this.socket?.write(packet);

    return new Promise((resolve, reject) => {
      this.socket?.once("data", (data) => {
        const type = data.readInt32LE(8);
        if (type === 2) {
          this.authed = true;
          resolve();
        } else {
          reject(new Error("RCON Auth Failed"));
        }
      });
    });
  }

  async exec(command: string): Promise<string> {
    if (!this.authed) throw new Error("Not authenticated");
    const packet = this.createPacket(2, command);
    this.socket?.write(packet);

    return new Promise((resolve) => {
      this.socket?.once("data", (data) => {
        const body = data.toString("ascii", 12, data.length - 2);
        resolve(body);
      });
    });
  }

  private createPacket(type: number, body: string): Buffer {
    const bodyLen = Buffer.byteLength(body);
    const packetLen = 4 + 4 + bodyLen + 2;
    const buf = Buffer.alloc(packetLen + 4);

    buf.writeInt32LE(packetLen, 0);
    buf.writeInt32LE(this.requestId++, 4);
    buf.writeInt32LE(type, 8);
    buf.write(body, 12, "ascii");
    buf.writeInt8(0, 12 + bodyLen);
    buf.writeInt8(0, 12 + bodyLen + 1);

    return buf;
  }

  destroy() {
    this.socket?.destroy();
    this.socket = null;
  }
}

export async function sendRconCommand(command: string): Promise<string> {
  const host = process.env.CS2_HOST || "127.0.0.1";
  const port = parseInt(process.env.CS2_PORT || "27015", 10);
  const password = process.env.CS2_RCONPW || "changeme";

  console.log(`[RCON] Enviar comando para ${host}:${port}: ${command}`);
  const client = new RconClient(host, port, password);
  try {
    await client.connect();
    const res = await client.exec(command);
    console.log(`[RCON] Resposta: ${res || "(vazio)"}`);
    return res;
  } catch (err) {
    console.error(`[RCON] Erro:`, err);
    throw err;
  } finally {
    client.destroy();
  }
}
