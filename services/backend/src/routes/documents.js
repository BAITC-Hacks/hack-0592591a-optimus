import { Router } from "express";

import { extractDocument } from "../extractorClient.js";
import { HttpError } from "../httpError.js";
import { uploadFields } from "../upload.js";

export const documents = Router();

// POST /api/documents/extract  (multipart/form-data, field "file": .docx/.pdf/.xlsx/.xlsm/.xls)
documents.post("/extract", uploadFields([{ name: "file", maxCount: 1 }]), async (req, res, next) => {
  try {
    const file = req.files?.file?.[0];
    if (!file) throw new HttpError(400, "bad_request", "Ожидается multipart/form-data с полем file.");
    const result = await extractDocument({
      buffer: file.buffer,
      filename: file.originalname,
      mimetype: file.mimetype,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});
