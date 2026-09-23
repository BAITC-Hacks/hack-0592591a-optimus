// Prompt templates live in src/prompts/*.md so they can be read and reviewed
// as text. {{name}} placeholders are filled here; a missing value is a bug.
import { readFileSync } from "node:fs";

const dir = new URL("./prompts/", import.meta.url);
const cache = new Map();

export function prompt(name, vars = {}) {
  let template = cache.get(name);
  if (template === undefined) {
    template = readFileSync(new URL(`${name}.md`, dir), "utf8");
    cache.set(name, template);
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`prompt ${name}: no value for {{${key}}}`);
    return String(vars[key]);
  });
}
