// Every LLM answer and the stored analysis are validated here (AGENTS.md §6:
// the code is the schema). LLM output is untrusted input.
import { z } from "zod";

export const CATEGORIES = ["perform_audit", "quality_control", "plan", "report", "method", "monitor", "interact", "other"];
export const UNIT_KINDS = ["block", "department", "direction", "position"];
export const FINDING_TYPES = ["POTENTIAL_LOSS", "MOVED", "OVERLAP", "POTENTIAL_DUPLICATION", "POTENTIAL_CONFLICT", "NOTE"];

const shortText = z.string().trim().max(400);
const id = z.string().trim().min(1).max(40);

// structure.md
export const StructureResponse = z.object({
  units: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(200),
        abbr: z.string().trim().max(20).nullable().optional(),
        kind: z.enum(UNIT_KINDS),
        parent: z.string().trim().max(200).nullable().optional(),
        source_clause: id,
      }),
    )
    .max(60),
});

// successors.md
export const SuccessorsResponse = z.object({
  changes: z
    .array(
      z.object({
        unit: z.string().trim().min(1).max(200),
        successors: z.array(z.string().trim().min(1).max(200)).max(10),
        reason: shortText,
      }),
    )
    .max(60),
});

// extract.md
export const ExtractResponse = z.object({
  functions: z
    .array(
      z.object({
        clause_id: id,
        owners: z.array(z.string().trim().min(1).max(120)).max(12),
        canonical: z.string().trim().min(3).max(200),
        category: z.enum(CATEGORIES).catch("other"),
      }),
    )
    .max(200),
});

// judge.md
export const JudgeResponse = z.object({
  results: z
    .array(
      z.object({
        id: id,
        candidate_id: id.nullable(),
        relation: z.enum(["same", "partial", "none"]),
        confidence: z.number().min(0).max(1).catch(0.5),
      }),
    )
    .max(100),
});

// dupjudge.md
export const DupJudgeResponse = z.object({
  results: z
    .array(
      z.object({
        pair_id: z.coerce.number().int(),
        relation: z.enum(["same", "overlap", "none"]),
        confidence: z.number().min(0).max(1).catch(0.5),
      }),
    )
    .max(100),
});

// conflict.md
export const ConflictResponse = z.object({
  reviews: z
    .array(
      z.object({
        pair_id: z.coerce.number().int(),
        verdict: z.enum(["potential_conflict", "none"]),
        reason: shortText,
      }),
    )
    .max(20),
});

// regulatory.md (O1, docs/TASK.md §12a)
export const RegulatoryResponse = z.object({
  results: z
    .array(
      z.object({
        id: id,
        norm_id: id.nullable(),
        relation: z.enum(["basis", "contradicts", "none"]),
        confidence: z.number().min(0).max(1).catch(0.5),
        reason: shortText,
      }),
    )
    .max(100),
});

// What leaves the API (docs/TASK.md §6). Validated before the final write.
export const Citation = z.object({
  doc_id: z.string(),
  side: z.enum(["before", "after"]),
  clause_id: z.string(),
  ref: z.string(),
  quote: z.string().min(1),
});

export const Finding = z.object({
  finding_id: z.string(),
  type: z.enum(FINDING_TYPES),
  severity: z.enum(["high", "medium", "low", "info"]),
  label: z.string(),
  units: z.array(z.string()),
  title: z.string(),
  explanation: z.string(),
  review: z.object({ verdict: z.string(), reason: z.string() }).nullable(),
  citations: z.array(Citation).min(1),
});

// O1: a function of «после» next to a norm. The org citation is verified like any
// finding; the norm quote is a verbatim line of the norm text, chosen by code.
export const REGULATORY_TYPES = ["REGULATORY_BASIS", "POTENTIAL_REGULATORY_CONFLICT"];
export const NormRef = z.object({
  norm_id: z.string(),
  origin: z.enum(["corpus", "uploaded"]),
  doc_id: z.string(),
  doc_title: z.string(),
  clause: z.string(),
  breadcrumb: z.string(),
  redaction_date: z.string().nullable(),
  source_url: z.string().nullable(),
  ref: z.string().nullable(),
  quote: z.string().min(1),
});
export const RegulatoryFinding = z.object({
  finding_id: z.string(),
  type: z.enum(REGULATORY_TYPES),
  severity: z.enum(["high", "medium", "low", "info"]),
  label: z.string(),
  units: z.array(z.string()),
  title: z.string(),
  explanation: z.string(),
  confidence: z.number().min(0).max(1),
  citations: z.array(Citation).min(1),
  norm: NormRef,
});

export const AnalysisResult = z.looseObject({
  units: z.array(
    z.looseObject({ unit_id: z.string(), side: z.enum(["before", "after"]), name: z.string(), abbr: z.string().nullable(), kind: z.enum(UNIT_KINDS), parent: z.string().nullable(), source_clause: z.string() }),
  ),
  unit_changes: z.array(
    z.looseObject({ status: z.enum(["kept", "created", "removed", "reorganized"]), before: z.string().nullable(), after: z.string().nullable(), successors: z.array(z.string()), reason: z.string() }),
  ),
  functions: z.object({ before: z.array(z.looseObject({ func_id: z.string(), clause_id: z.string(), owners: z.array(z.string()), canonical: z.string(), category: z.enum(CATEGORIES), quote: z.string() })), after: z.array(z.looseObject({ func_id: z.string(), clause_id: z.string() })) }),
  matches: z.array(z.looseObject({ before_id: z.string(), after_id: z.string().nullable(), relation: z.enum(["same", "partial", "moved", "unmatched"]), confidence: z.number(), steps: z.array(z.string()) })),
  findings: z.array(Finding),
  regulatory: z.array(RegulatoryFinding).optional(),
  conclusion_md: z.string(),
  stats: z.looseObject({}),
});

// classify.md: is an uploaded document about an organisation's units and their functions at all?
export const ClassifyResponse = z.object({
  relevant: z.boolean(),
  kind: z.enum(["org_structure", "unit_regulation", "other"]).catch("other"),
  summary: z.string().max(300).catch(""),
  reason: z.string().max(400).catch(""),
});
