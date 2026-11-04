import { HvigorNode, HvigorPlugin } from '@ohos/hvigor';
import { appTasks, OhosAppContext, OhosPluginId } from '@ohos/hvigor-ohos-plugin';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const environmentPlugin: HvigorPlugin = {
  pluginId: 'com.portra.environment',
  apply(node: HvigorNode): void {
    const context = node.getContext(OhosPluginId.OHOS_APP_PLUGIN) as OhosAppContext;
    const profile = context.getBuildProfileOpt();
    const product = context.getCurrentProduct();
    const productName = product.getProductName();
    const environment = productName === 'default' ? 'dev' : productName;
    if (!['dev', 'staging', 'production'].includes(environment)) {
      throw new Error(`Cannot configure unknown product ${productName}.`);
    }
    const selected = profile.app.products?.find(item => item.name === productName);
    if (selected === undefined) {
      throw new Error(`Cannot configure unknown product ${productName}.`);
    }

    // IDE Run/Debug does not inherit variables set in a separate terminal.
    // Read only the selected environment; never fall back to another server.
    const localPath = join(context.getProjectPath(), 'portra-environments.local.json');
    let localUrls: Record<string, string> = {};
    if (existsSync(localPath)) {
      try {
        const parsed = JSON.parse(readFileSync(localPath, 'utf8'));
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) ||
          Object.keys(parsed).some(key => !['dev', 'staging', 'production'].includes(key) ||
            typeof parsed[key] !== 'string')) {
          throw new Error('Invalid environment map');
        }
        localUrls = parsed;
      } catch {
        // Do not echo local file contents or parser errors into build logs.
        throw new Error('portra-environments.local.json must map dev/staging/production to URL strings.');
      }
    }
    const override = (process.env.PORTRA_BASE_URL ?? '').trim();
    if (override.length > 0 && process.env.PORTRA_ENVIRONMENT !== environment) {
      throw new Error(`Set PORTRA_ENVIRONMENT=${environment} together with PORTRA_BASE_URL to confirm the override target.`);
    }
    const fields = selected.buildOption?.arkOptions?.buildProfileFields;
    const baseUrl = (override || localUrls[environment]?.trim() ||
      String(fields?.PORTRA_BASE_URL ?? '').trim()).replace(/\/$/, '');

    if (context.getBuildMode() === 'release' && (environment === 'dev' || baseUrl.length === 0)) {
      throw new Error('Release requires an explicitly configured staging or production HTTPS origin.');
    }
    if (baseUrl.length === 0) {
      console.warn(`[Portra] ${environment}: API disabled. Configure ${environment} in portra-environments.local.json or set PORTRA_ENVIRONMENT and PORTRA_BASE_URL. Use HallPreviewEntry.ets for UI preview.`);
    }

    if (baseUrl.length > 0) {
      const originPattern = /^https?:\/\/[a-zA-Z0-9.-]+(:[0-9]{1,5})?\/?$/;
      if (!originPattern.test(baseUrl)) {
        throw new Error('PORTRA_BASE_URL must be an HTTP(S) origin without credentials, path, query or fragment.');
      }
      const authority = baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const portSeparator = authority.lastIndexOf(':');
      if (portSeparator >= 0) {
        const port = Number(authority.slice(portSeparator + 1));
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error('PORTRA_BASE_URL contains an invalid port.');
        }
      }
      if (productName !== 'default' && productName !== 'dev' && !baseUrl.startsWith('https://')) {
        throw new Error(`Product ${productName} requires an HTTPS PORTRA_BASE_URL.`);
      }
    }

    selected.buildOption = selected.buildOption ?? {};
    selected.buildOption.arkOptions = selected.buildOption.arkOptions ?? {};
    selected.buildOption.arkOptions.buildProfileFields = {
      PORTRA_SOURCE_SHA: process.env.PORTRA_SOURCE_SHA || 'uncommitted',
      ...(selected.buildOption.arkOptions.buildProfileFields ?? {}),
      PORTRA_ENVIRONMENT: environment,
      PORTRA_BASE_URL: baseUrl
    };
    context.setBuildProfileOpt(profile);
  }
};

export default {
  system: appTasks, /* Built-in plugin of Hvigor. It cannot be modified. */
  plugins: [environmentPlugin]
}
