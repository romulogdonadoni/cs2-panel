/**
 * `MATCHZY_WEBHOOK_SECRET` — se definido, exige `Authorization: Bearer` ou `x-matchzy-secret` com o mesmo valor.
 * Se vazio: aceita sem header, ou o segredo legado `matchzy-pug-secret` no `x-matchzy-secret`.
 */
export function matchzyWebhookAuthOk(request: Request): boolean {
  const expected = process.env.MATCHZY_WEBHOOK_SECRET?.trim();
  const auth = request.headers.get("Authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : auth?.trim() ?? "";
  const x = request.headers.get("x-matchzy-secret");
  if (expected) {
    return bearer === expected || x === expected;
  }
  if (!x) {
    return true;
  }
  return x === "matchzy-pug-secret";
}
