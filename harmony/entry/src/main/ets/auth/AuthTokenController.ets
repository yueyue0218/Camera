/** Keeps authenticated transport state aligned with the active app session. */
export interface AuthTokenController {
  setAccessToken(token: string): void;
  /** Rotates credentials within the same identity without cancelling its requests. */
  replaceAccessToken(token: string): void;
  clearAccessToken(): void;
}
