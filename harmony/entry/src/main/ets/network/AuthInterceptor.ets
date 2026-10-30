/**
 * Adds the current bearer token to authenticated requests.
 *
 * Access tokens stay in memory; AuthSessionManager owns refresh and Asset Store.
 */
export class AuthInterceptor {
  private accessToken: string = '';

  setAccessToken(token: string): void {
    this.accessToken = token.trim();
  }

  clearAccessToken(): void {
    this.accessToken = '';
  }

  replaceAccessToken(token: string): void {
    this.setAccessToken(token);
  }

  authorizationHeader(): string {
    if (this.accessToken.length === 0) {
      return '';
    }
    return `Bearer ${this.accessToken}`;
  }
}
