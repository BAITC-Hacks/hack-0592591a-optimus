// Multipart uploads for every route: files stay in memory (never written to disk)
// and multer errors map to the shared {"error": {"code", "message"}} shape.
import multer from "multer";

import { HttpError } from "./httpError.js";

export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 20;

/**
 * @param {{name: string, maxCount: number}[]} fields  multipart file fields
 * @returns express middleware that fills req.files[name] (arrays)
 */
export function uploadFields(fields) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_UPLOAD_MB * 1024 * 1024,
      files: fields.reduce((sum, field) => sum + field.maxCount, 0),
      fields: 10,
      fieldSize: 1024,
    },
    defParamCharset: "utf8", // keep Cyrillic file names intact
  }).fields(fields);

  const names = fields.map((field) => `${field.name} (до ${field.maxCount})`).join(", ");
  return (req, res, next) =>
    upload(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new HttpError(413, "file_too_large", `Файл больше ${MAX_UPLOAD_MB} МБ.`));
        }
        return next(new HttpError(400, "bad_request", `Ожидаются файлы в полях: ${names}.`));
      }
      return next(new HttpError(400, "bad_request", "Некорректный multipart-запрос."));
    });
}

const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/**
 * Cheap up-front type check so a wrong file is refused with 415 before an
 * analysis is queued. The extractor still detects the exact format later.
 * @returns {"pdf"|"docx"|"xlsx"|"xls"|null}
 */
export function sniffFileType(buffer, filename) {
  const name = (filename || "").toLowerCase();
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buffer.subarray(0, 4).equals(Buffer.from("PK\x03\x04", "latin1"))) {
    if (name.endsWith(".docx")) return "docx";
    if (name.endsWith(".xlsx") || name.endsWith(".xlsm")) return "xlsx";
    return null;
  }
  if (buffer.subarray(0, 8).equals(OLE) && name.endsWith(".xls")) return "xls";
  return null;
}
