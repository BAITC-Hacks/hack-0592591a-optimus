// O1 norms (AGENTS.md §7a, docs/TASK.md §12a): the adilet.zan.kz slice shipped in
// data/regulatory/<doc_id>.jsonl, one raw corpus piece per line. Every line is
// validated here; only acts in force with an adilet link get in. Stored in Mongo
// `regulatory_norms` (unique on doc_id + chunk_index) with a cached embedding.
import { readdirSync, readFileSync } from "node:fs";
import { z } from "zod";

import { getDb } from "./db.js";

export const DATA_DIR = new URL("../data/regulatory/", import.meta.url);
export const ADILET_URL = /^https:\/\/adilet\.zan\.kz\/(rus|kaz)\/docs\/[A-Za-z0-9_]+(#z\d+)?$/;

const NormRow = z.looseObject({
  doc_id: z.string().regex(/^[A-Za-z0-9_]+$/),
  lang: z.literal("rus"),
  doc_title: z.string().min(1),
  doc_type: z.string().nullish(),
  status: z.literal("действует"),
  redaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  section: z.string().nullish(),
  article: z.string().nullable(),
  article_title: z.string().nullish(),
  point: z.string().nullish(),
  text: z.string().trim().min(1),
  breadcrumb: z.string().nullish(),
  chunk_index: z.number().int().min(0),
  source_url: z.string().regex(ADILET_URL),
});

const collection = () => getDb().collection("regulatory_norms");

/** "Статья 61, п. 3" / "Статья 53-1" / "Преамбула". */
export function clauseOf(row) {
  if (!row.article) return row.article_title || "Преамбула";
  return `Статья ${row.article}${row.point ? `, п. ${row.point}` : ""}`;
}

/** One corpus piece → the norm shape the pipeline and the UI use. */
export function toNorm(row) {
  const clause = clauseOf(row);
  return {
    norm_id: `${row.doc_id}#${row.chunk_index}`,
    origin: "corpus",
    doc_id: row.doc_id,
    doc_title: row.doc_title,
    doc_type: row.doc_type ?? null,
    article: row.article,
    point: row.point ?? null,
    article_title: row.article_title ?? null,
    clause,
    text: row.text,
    breadcrumb: row.breadcrumb || `${row.doc_title} | ${clause}`,
    redaction_date: row.redaction_date,
    source_url: row.source_url,
    chunk_index: row.chunk_index,
  };
}

/** All shipped norms, validated. A bad line fails loudly with file and line number. */
export function readNormFiles(dir = DATA_DIR) {
  let files;
  try {
    files = readdirSync(dir).filter((name) => name.endsWith(".jsonl")).sort();
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  const norms = [];
  for (const file of files) {
    const lines = readFileSync(new URL(file, dir), "utf8").split("\n");
    lines.forEach((line, index) => {
      if (!line.trim()) return;
      let raw;
      try {
        raw = JSON.parse(line);
      } catch {
        throw new Error(`${file}:${index + 1}: not valid JSON`);
      }
      const parsed = NormRow.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(`${file}:${index + 1}: ${issue.path.join(".")}: ${issue.message}`);
      }
      norms.push(toNorm(parsed.data));
    });
  }
  return norms;
}

/**
 * Loads the shipped files into Mongo. Idempotent: rows are upserted by
 * (doc_id, chunk_index), and acts no longer shipped are removed. A cached
 * embedding stays only while its text is unchanged (see saveNormEmbeddings).
 */
export async function loadRegulatoryNorms(norms = readNormFiles()) {
  const col = collection();
  await col.createIndex({ doc_id: 1, chunk_index: 1 }, { unique: true, name: "doc_chunk_unique" });
  const docIds = [...new Set(norms.map((n) => n.doc_id))];
  await col.deleteMany({ doc_id: { $nin: docIds } });
  if (norms.length) {
    await col.bulkWrite(
      norms.map((norm) => ({
        updateOne: { filter: { doc_id: norm.doc_id, chunk_index: norm.chunk_index }, update: { $set: norm }, upsert: true },
      })),
      { ordered: false },
    );
  }
  return { pieces: norms.length, acts: docIds.length };
}

/** Norms for one analysis run, with any cached embedding. */
export async function findRegulatoryNorms() {
  return collection()
    .find({}, { projection: { _id: 0 } })
    .sort({ doc_id: 1, chunk_index: 1 })
    .toArray();
}

/** Caches vectors computed during a run: [{norm_id, embedding, embedding_key}]. */
export async function saveNormEmbeddings(updates) {
  if (!updates.length) return;
  await collection().bulkWrite(
    updates.map(({ norm_id, embedding, embedding_key }) => {
      const [doc_id, chunk] = norm_id.split("#");
      return { updateOne: { filter: { doc_id, chunk_index: Number(chunk) }, update: { $set: { embedding, embedding_key } } } };
    }),
    { ordered: false },
  );
}
