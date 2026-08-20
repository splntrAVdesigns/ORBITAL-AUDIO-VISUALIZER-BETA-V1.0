const PRESET_HUD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  DEFAULT: 'DEFAULT',
  'Chill Lofi': 'CHILL LFI',
  'Bass Earthquake': 'BASS EQ',
  'Electric Tempest': 'ELEC TMP',
  'Neon Arcade': 'NEON ARC',
  'Hypnotic Trance': 'HYPN TRN',
  'Minimal Zen': 'MIN ZEN',
  Minimalscape: 'MIN SCAPE',
  'Cinematic Epic': 'CINE EPIC',
  'Retro Synthwave': 'RETRO SW',
  'Glitch Matrix': 'GLITCH MX',
  'Blang it Out': 'BLANG OUT',
  'Sacred Mandala': 'SACRED MD',
  'Cosmic Geometry': 'COSMIC GEO',
  'Fractal Dreams': 'FRAC DRM',
  'Particle Storm': 'PRTCL STM',
  'Deep Bass Vision': 'DEEP BASS',
  'Logo Spinner': 'LOGO SPN',
  'Frequency Bloom': 'FREQ BLM',
  'Ethereal Bloom': 'ETHR BLM',
  RANDOM: 'RANDOM',
});

export function formatPresetNameForHud(value: unknown, maxLength = 10): string {
  const fullName = String(value ?? '').trim() || 'DEFAULT';
  const known = PRESET_HUD_LABELS[fullName];
  if (known) return known;
  const compact = fullName.replace(/\s+/g, ' ').toUpperCase();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
}
