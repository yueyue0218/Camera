/** Keeps authenticated transport state aligned with the active app session. */
export interface AuthTokenController {
  setAccessToken(token: string): void;
  clearAccessToken(): void;
}
