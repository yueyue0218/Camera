import { HvigorNode, HvigorPlugin } from '@ohos/hvigor';
import { appTasks, OhosAppContext, OhosPluginId } from '@ohos/hvigor-ohos-plugin';

const environmentPlugin: HvigorPlugin = {
  pluginId: 'com.portra.environment',
  apply(node: HvigorNode): void {
    const context = node.getContext(OhosPluginId.OHOS_APP_PLUGIN) as OhosAppContext;
    const profile = context.getBuildProfileOpt();
    const product = context.getCurrentProduct();
    const productName = product.getProductName();
    const baseUrl = (process.env.PORTRA_BASE_URL ?? '').trim();

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

    const selected = profile.app.products?.find(item => item.name === productName);
    if (selected === undefined) {
      throw new Error(`Cannot configure unknown product ${productName}.`);
    }
    selected.buildOption = selected.buildOption ?? {};
    selected.buildOption.arkOptions = selected.buildOption.arkOptions ?? {};
    selected.buildOption.arkOptions.buildProfileFields = {
      ...(selected.buildOption.arkOptions.buildProfileFields ?? {}),
      PORTRA_BASE_URL: baseUrl
    };
    context.setBuildProfileOpt(profile);
  }
};

export default {
  system: appTasks, /* Built-in plugin of Hvigor. It cannot be modified. */
  plugins: [environmentPlugin]
}
