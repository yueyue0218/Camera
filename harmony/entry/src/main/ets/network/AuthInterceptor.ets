/**
 * Adds the current bearer token to authenticated requests.
 *
 * Token persistence is deliberately not implemented here. D10 will connect
 * this in-memory boundary to the selected secure storage API after the auth
 * contract is confirmed with B.
 */
export class AuthInterceptor {
  private accessToken: string = '';

  setAccessToken(token: string): void {
    this.accessToken = token.trim();
  }

  clearAccessToken(): void {
    this.accessToken = '';
  }

  authorizationHeader(): string {
    if (this.accessToken.length === 0) {
      return '';
    }
    return `Bearer ${this.accessToken}`;
  }
}
