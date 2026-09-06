/**
 * Secure credential boundary for D10.
 *
 * The concrete implementation will be connected to the approved HarmonyOS
 * secure-storage API after B confirms the final login/session contract. This
 * interface intentionally does not expose password persistence.
 */
export interface StoredCredential {
  readonly accessToken: string;
  readonly environment: string;
}

export interface CredentialStore {
  load(): Promise<StoredCredential | null>;
  save(credential: StoredCredential): Promise<void>;
  clear(): Promise<void>;
}
