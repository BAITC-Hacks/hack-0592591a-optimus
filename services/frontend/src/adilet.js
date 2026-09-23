// Link to a clause on adilet.zan.kz (AGENTS.md §7a, rule 5). Built by code from the
// stored source_url, never from model output, and only for the expected path shape.
// ADILET_BASE is the one place to switch hosts: on 23.09.2026 the new
// adilet.zan.kz was a test version whose deep links did not open the act, while
// the old host scrolled to the clause.
export const ADILET_BASE = "https://old.adilet.zan.kz";
const PATH = /^\/(rus|kaz)\/docs\/[A-Za-z0-9_]+(#z\d+)?$/;

export function adiletHref(sourceUrl) {
  if (typeof sourceUrl !== "string") return null;
  let url;
  try {
    url = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.hostname !== "adilet.zan.kz") return null;
  const path = `${url.pathname}${url.hash}`;
  return PATH.test(path) ? `${ADILET_BASE}${path}` : null;
}

/** "2026-08-13" → "13.08.2026". */
export const ruDate = (iso) => (iso ? iso.split("-").reverse().join(".") : "");
