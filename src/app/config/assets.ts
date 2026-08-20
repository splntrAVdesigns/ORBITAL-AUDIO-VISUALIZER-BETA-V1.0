import orbitalLogoUrl from '../../../assets/c80aa982ac9f9f0accc2e8fa020529c7250adeb5.png?inline';
import iconLogoUrl from '../../../assets/6a628cfc4040bec6f754d249d9bf9f3431785802.png?inline';
import defaultCenterLogoUrl from '../../../assets/c07a706be6b5d99d8083377c61a56d294c064ec0.png?inline';

import { RUNTIME_IS_DEVELOPMENT } from './runtimeEnvironment';

export type BuiltInAssetKey =
  | 'orbitalLogo'
  | 'iconLogo'
  | 'defaultCenterLogo';

export interface BuiltInAssetDefinition {
  readonly key: BuiltInAssetKey;
  readonly url: string;
  readonly label: string;
  readonly mediaKind: 'logo';
  readonly preferredZoom?: number;
}

/**
 * Small ORBITAL-owned logos are deliberately embedded into the application
 * bundle. This avoids host-specific asset routing differences between Figma
 * Make previews, Vercel, local Vite, and future worker/bootstrap entry points.
 */
export const BUILT_IN_ASSET_TRANSPORT = 'inline-data-url' as const;

export const BUILT_IN_ASSETS: Readonly<
  Record<BuiltInAssetKey, BuiltInAssetDefinition>
> = Object.freeze({
  orbitalLogo: Object.freeze({
    key: 'orbitalLogo',
    url: orbitalLogoUrl,
    label: 'ORBITAL wordmark',
    mediaKind: 'logo',
  }),

  iconLogo: Object.freeze({
    key: 'iconLogo',
    url: iconLogoUrl,
    label: 'ORBITAL icon',
    mediaKind: 'logo',
    preferredZoom: 78 / 125,
  }),

  defaultCenterLogo: Object.freeze({
    key: 'defaultCenterLogo',
    url: defaultCenterLogoUrl,
    label: 'ORBITAL center wordmark',
    mediaKind: 'logo',
  }),
});

export const orbitalLogo = BUILT_IN_ASSETS.orbitalLogo.url;
export const iconLogo = BUILT_IN_ASSETS.iconLogo.url;
export const defaultCenterLogo = BUILT_IN_ASSETS.defaultCenterLogo.url;

const failedAssetKeys = new Set<BuiltInAssetKey>();
const INLINE_PNG_PREFIX = 'data:image/png;base64,';

export function isInlineBuiltInAssetUrl(url: string): boolean {
  return url.startsWith(INLINE_PNG_PREFIX) && url.length > INLINE_PNG_PREFIX.length;
}

function createFallbackSvg(label: string): string {
  const safeLabel = label.replace(/[&<>"']/g, '');

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
      width="480"
      height="160"
      viewBox="0 0 480 160">
      <rect width="480" height="160" rx="12" fill="#0a111d"/>
      <rect
        x="2"
        y="2"
        width="476"
        height="156"
        rx="10"
        fill="none"
        stroke="#1e90ff"
        stroke-opacity=".55"
        stroke-width="3"
      />
      <text
        x="240"
        y="78"
        dominant-baseline="middle"
        text-anchor="middle"
        fill="#1e90ff"
        font-family="system-ui, sans-serif"
        font-size="24"
        font-weight="700"
      >
        ORBITAL
      </text>
      <text
        x="240"
        y="112"
        dominant-baseline="middle"
        text-anchor="middle"
        fill="#7894aa"
        font-family="system-ui, sans-serif"
        font-size="13"
      >
        ${safeLabel} unavailable
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function recoverBuiltInAssetImage(
  image: HTMLImageElement,
  key: BuiltInAssetKey,
): void {
  const asset = BUILT_IN_ASSETS[key];

  if (!failedAssetKeys.has(key)) {
    failedAssetKeys.add(key);

    if (RUNTIME_IS_DEVELOPMENT) {
      console.error(
        `[ORBITAL assets] Failed to load ${key} (${BUILT_IN_ASSET_TRANSPORT})`,
      );
    }
  }

  image.onerror = null;
  image.alt = `${asset.label} unavailable`;
  image.src = createFallbackSvg(asset.label);
}

export function assertBuiltInAssetRegistry(): void {
  const seenUrls = new Set<string>();

  for (const [registryKey, asset] of Object.entries(BUILT_IN_ASSETS) as Array<
    [BuiltInAssetKey, BuiltInAssetDefinition]
  >) {
    if (asset.key !== registryKey) {
      throw new Error(
        `[ORBITAL assets] Registry key mismatch: ${registryKey} !== ${asset.key}`,
      );
    }

    if (!asset.label.trim()) {
      throw new Error(`[ORBITAL assets] Missing label for ${asset.key}`);
    }

    if (!isInlineBuiltInAssetUrl(asset.url)) {
      throw new Error(
        `[ORBITAL assets] ${asset.key} must use inline PNG transport`,
      );
    }

    if (seenUrls.has(asset.url)) {
      throw new Error(
        `[ORBITAL assets] Duplicate built-in asset payload for ${asset.key}`,
      );
    }

    seenUrls.add(asset.url);
  }
}
