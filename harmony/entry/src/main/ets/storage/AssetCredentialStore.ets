import { util } from '@kit.ArkTS';
import { asset } from '@kit.AssetStoreKit';
import { BusinessError } from '@kit.BasicServicesKit';
import {
  CredentialOperation,
  CredentialStore,
  CredentialStoreError,
  StoredCredential
} from './CredentialStore';

/** Stores one access token in the app-scoped HarmonyOS Asset Store. */
export class AssetCredentialStore implements CredentialStore {
  private readonly environment: string;
  private readonly alias: Uint8Array;
  private readonly encoder: util.TextEncoder = new util.TextEncoder();
  private readonly decoder: util.TextDecoder = util.TextDecoder.create('utf-8', { fatal: true });

  constructor(environment: string, cacheNamespace: string) {
    this.environment = environment;
    this.alias = this.encoder.encodeInto(`${cacheNamespace}:access-token`);
  }

  async load(): Promise<StoredCredential | null> {
    const query: asset.AssetMap = new Map<asset.Tag, asset.Value>();
    query.set(asset.Tag.ALIAS, this.alias);
    query.set(asset.Tag.RETURN_TYPE, asset.ReturnType.ALL);
    query.set(asset.Tag.RETURN_LIMIT, 1);

    let records: Array<asset.AssetMap>;
    try {
      records = await asset.query(query);
    } catch (error) {
      const code = (error as BusinessError)?.code;
      if (code === asset.ErrorCode.NOT_FOUND) {
        return null;
      }
      throw new CredentialStoreError(CredentialOperation.LOAD, code);
    }

    if (records.length !== 1) {
      throw new CredentialStoreError(CredentialOperation.LOAD);
    }
    const secret = records[0].get(asset.Tag.SECRET);
    if (!(secret instanceof Uint8Array)) {
      throw new CredentialStoreError(CredentialOperation.LOAD);
    }

    let accessToken: string;
    try {
      accessToken = this.decoder.decodeToString(secret).trim();
    } catch {
      throw new CredentialStoreError(CredentialOperation.LOAD);
    }
    if (accessToken.length === 0) {
      throw new CredentialStoreError(CredentialOperation.LOAD);
    }
    return { accessToken: accessToken, environment: this.environment };
  }

  async save(credential: StoredCredential): Promise<void> {
    const accessToken = credential.accessToken.trim();
    if (credential.environment !== this.environment || accessToken.length === 0) {
      throw new CredentialStoreError(CredentialOperation.SAVE);
    }

    const attributes: asset.AssetMap = new Map<asset.Tag, asset.Value>();
    attributes.set(asset.Tag.ALIAS, this.alias);
    attributes.set(asset.Tag.SECRET, this.encoder.encodeInto(accessToken));
    attributes.set(asset.Tag.ACCESSIBILITY, asset.Accessibility.DEVICE_FIRST_UNLOCKED);
    attributes.set(asset.Tag.AUTH_TYPE, asset.AuthType.NONE);
    attributes.set(asset.Tag.SYNC_TYPE, asset.SyncType.NEVER);
    attributes.set(asset.Tag.REQUIRE_ATTR_ENCRYPTED, true);
    attributes.set(asset.Tag.CONFLICT_RESOLUTION, asset.ConflictResolution.OVERWRITE);
    try {
      await asset.add(attributes);
    } catch (error) {
      throw new CredentialStoreError(CredentialOperation.SAVE, (error as BusinessError)?.code);
    }
  }

  async clear(): Promise<void> {
    const query: asset.AssetMap = new Map<asset.Tag, asset.Value>();
    query.set(asset.Tag.ALIAS, this.alias);
    try {
      await asset.remove(query);
    } catch (error) {
      const code = (error as BusinessError)?.code;
      if (code !== asset.ErrorCode.NOT_FOUND) {
        throw new CredentialStoreError(CredentialOperation.CLEAR, code);
      }
    }
  }
}
