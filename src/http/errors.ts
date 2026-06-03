import { ForbiddenError, NotFoundError } from "../application/authorization.js";

export const mapErrorToStatus = (error: unknown): { statusCode: number; message: string } => {
  if (error instanceof ForbiddenError) {
    return { statusCode: 403, message: error.message };
  }
  if (error instanceof NotFoundError) {
    return { statusCode: 404, message: error.message };
  }
  if (error instanceof Error && error.message.startsWith("Unauthorized")) {
    return { statusCode: 401, message: error.message };
  }
  if (error instanceof Error) {
    return { statusCode: 500, message: error.message };
  }
  return { statusCode: 500, message: "Internal server error" };
};
