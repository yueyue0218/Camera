/**
 * Secure credential boundary for D10.
 *
 * This interface intentionally stores only the server-issued refresh token.
 * Short-lived access tokens remain in memory.
 * Passwords, verification codes and user profile data do not belong here.
 */
export interface StoredCredential {
  readonly refreshToken: string;
  readonly environment: string;
}

export interface CredentialStore {
  load(): Promise<StoredCredential | null>;
  save(credential: StoredCredential): Promise<void>;
  clear(): Promise<void>;
}

export enum CredentialOperation {
  LOAD = 'load',
  SAVE = 'save',
  CLEAR = 'clear'
}

export class CredentialStoreError extends Error {
  readonly operation: CredentialOperation;
  readonly code: number;

  constructor(operation: CredentialOperation, code: number = 0) {
    super(`Credential ${operation} failed.`);
    this.operation = operation;
    this.code = code;
  }
}
