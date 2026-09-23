import { Router } from "express";
import multer from "multer";

import { extractDocument } from "../extractorClient.js";
import { HttpError } from "../httpError.js";

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 20;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 10, fieldSize: 1024 },
  defParamCharset: "utf8", // keep Cyrillic file names intact
});

function singleFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new HttpError(413, "file_too_large", `Файл больше ${MAX_UPLOAD_MB} МБ.`));
      }
      return next(new HttpError(400, "bad_request", "Ожидается один файл в поле file."));
    }
    return next(new HttpError(400, "bad_request", "Некорректный multipart-запрос."));
  });
}

export const documents = Router();

// POST /api/documents/extract  (multipart/form-data, field "file": .docx/.pdf/.xlsx/.xlsm/.xls)
documents.post("/extract", singleFile, async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "bad_request", "Ожидается multipart/form-data с полем file.");
    const result = await extractDocument({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
