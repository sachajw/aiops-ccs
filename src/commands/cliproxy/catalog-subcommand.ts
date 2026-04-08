import { initUI, header, subheader, color, dim } from '../../utils/ui';
import {
  getCacheAge,
  clearCatalogCache,
  SYNCABLE_PROVIDERS,
  getResolvedCatalog,
  refreshCatalogFromProxy,
} from '../../cliproxy/catalog-cache';
import { getProxyTarget } from '../../cliproxy/proxy-target-resolver';
import type { CLIProxyProvider } from '../../cliproxy/types';
import type { RemoteModelInfo } from '../../cliproxy/management-api-types';

/** Fetch model definitions from CLIProxyAPI for all syncable providers */
async function fetchRemoteCatalogs(
  verbose: boolean
): Promise<Record<string, RemoteModelInfo[]> | null> {
  const target = getProxyTarget();

  if (verbose) {
    console.log(
      dim(
        `  Connected to ${target.protocol}://${target.host}:${target.port} (${target.isRemote ? 'remote' : 'local'})`
      )
    );
  }

  const result = await refreshCatalogFromProxy();
  if (verbose && result) {
    for (const provider of SYNCABLE_PROVIDERS) {
      const models = result[provider];
      if (models?.length) {
        console.log(dim(`  ${provider}: ${models.length} models`));
      }
    }
  }

  return result;
}

/** Show catalog status */
export async function handleCatalogStatus(verbose: boolean): Promise<void> {
  await initUI();
  console.log('');
  console.log(header('Model Catalog'));
  console.log('');

  const cacheAge = getCacheAge();
  if (cacheAge) {
    console.log(`  Cache: ${color('synced', 'success')} (${cacheAge})`);
  } else {
    console.log(`  Cache: ${color('static only', 'warning')} (no sync)`);
  }

  console.log('');
  console.log(subheader('Providers:'));

  for (const provider of SYNCABLE_PROVIDERS) {
    const catalog = getResolvedCatalog(provider);
    if (catalog) {
      const count = catalog.models.length;
      console.log(`  ${color(catalog.displayName.padEnd(20), 'command')} ${count} models`);
      if (verbose) {
        for (const model of catalog.models) {
          console.log(dim(`    - ${model.id} (${model.name})`));
        }
      }
    }
  }

  console.log('');
  if (!cacheAge) {
    console.log(dim('  Run "ccs cliproxy catalog refresh" to sync from CLIProxy'));
  }
  console.log('');
}

/** Refresh catalog from CLIProxyAPI */
export async function handleCatalogRefresh(verbose: boolean): Promise<void> {
  await initUI();
  console.log('');
  console.log(header('Catalog Refresh'));
  console.log('');

  const result = await fetchRemoteCatalogs(verbose);
  if (!result) {
    console.log('  Failed to fetch live catalogs. Static catalog unchanged.');
    console.log('');
    return;
  }

  // Show summary
  let totalModels = 0;
  for (const [provider, models] of Object.entries(result)) {
    const merged = getResolvedCatalog(provider as CLIProxyProvider);
    const mergedCount = merged?.models.length ?? 0;
    console.log(
      `  ${color(provider.padEnd(12), 'command')} ${models.length} live -> ${mergedCount} merged`
    );
    totalModels += mergedCount;
  }

  console.log('');
  console.log(`  ${color('[OK]', 'success')} Catalog synced (${totalModels} total models)`);
  console.log('');
}

/** Reset catalog cache */
export async function handleCatalogReset(): Promise<void> {
  await initUI();
  console.log('');

  const cleared = clearCatalogCache();
  if (cleared) {
    console.log(`  ${color('[OK]', 'success')} Catalog cache cleared. Using static catalog.`);
  } else {
    console.log('  No cache to clear.');
  }
  console.log('');
}
