/** Client-facing error: rendered as {"error": {"code", "message"}} with the given status. */
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
