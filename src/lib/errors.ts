// ── Error model ──────────────────────────────────────────────────────────────
// Every backend (mock or Supabase) raises BackendError with a machine code +
// a human-friendly message, so the UI can show helpful text (doc §61).

export type BackendErrorCode =
  | 'invalid_credentials'
  | 'unauthenticated'
  | 'permission'
  | 'not_found'
  | 'duplicate'
  | 'duplicate_email'
  | 'not_student'
  | 'account_inactive'
  | 'token_invalid'
  | 'token_expired'
  | 'session_closed'
  | 'not_enrolled'
  | 'already_marked'
  | 'validation'
  | 'unknown';

export class BackendError extends Error {
  code: BackendErrorCode;
  constructor(code: BackendErrorCode, message: string) {
    super(message);
    this.name = 'BackendError';
    this.code = code;
  }
}

/** Extract a friendly message from any thrown value. */
export function errMessage(e: unknown): string {
  if (e instanceof BackendError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}

export function errCode(e: unknown): string {
  if (e instanceof BackendError) return e.code;
  return 'unknown';
}
