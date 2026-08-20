/**
 * Exact reviewed inventory that Figma Make retains even when modules are not
 * imported by the ORBITAL application graph. New unreachable files are not
 * tolerated automatically and must be reviewed before being added here.
 */
export const FIGMA_RETAINED_INACTIVE_SOURCE = Object.freeze([
  'src/app/components/figma/ImageWithFallback.tsx',
  'src/app/components/ui/accordion.tsx',
  'src/app/components/ui/alert-dialog.tsx',
  'src/app/components/ui/alert.tsx',
  'src/app/components/ui/aspect-ratio.tsx',
  'src/app/components/ui/avatar.tsx',
  'src/app/components/ui/badge.tsx',
  'src/app/components/ui/breadcrumb.tsx',
  'src/app/components/ui/button.tsx',
  'src/app/components/ui/calendar.tsx',
  'src/app/components/ui/card.tsx',
  'src/app/components/ui/carousel.tsx',
  'src/app/components/ui/chart.tsx',
  'src/app/components/ui/checkbox.tsx',
  'src/app/components/ui/collapsible.tsx',
  'src/app/components/ui/command.tsx',
  'src/app/components/ui/context-menu.tsx',
  'src/app/components/ui/dialog.tsx',
  'src/app/components/ui/drawer.tsx',
  'src/app/components/ui/dropdown-menu.tsx',
  'src/app/components/ui/form.tsx',
  'src/app/components/ui/hover-card.tsx',
  'src/app/components/ui/input-otp.tsx',
  'src/app/components/ui/input.tsx',
  'src/app/components/ui/label.tsx',
  'src/app/components/ui/menubar.tsx',
  'src/app/components/ui/navigation-menu.tsx',
  'src/app/components/ui/pagination.tsx',
  'src/app/components/ui/popover.tsx',
  'src/app/components/ui/progress.tsx',
  'src/app/components/ui/radio-group.tsx',
  'src/app/components/ui/resizable.tsx',
  'src/app/components/ui/scroll-area.tsx',
  'src/app/components/ui/select.tsx',
  'src/app/components/ui/separator.tsx',
  'src/app/components/ui/sidebar.tsx',
  'src/app/components/ui/skeleton.tsx',
  'src/app/components/ui/slider.tsx',
  'src/app/components/ui/sonner.tsx',
  'src/app/components/ui/switch.tsx',
  'src/app/components/ui/table.tsx',
  'src/app/components/ui/tabs.tsx',
  'src/app/components/ui/textarea.tsx',
  'src/app/components/ui/toggle-group.tsx',
  'src/app/components/ui/toggle.tsx',
  'src/app/components/ui/tooltip.tsx',
  'src/app/components/ui/use-mobile.ts',
  // Retained by request. This is not the active shortcut implementation.
  'src/app/hooks/useKeyboardShortcuts.ts',
  // Source-level parity fixtures and compatibility adapter are exercised by scripts,
  // not imported into the production application bundle.
  'src/app/runtime/visualizer/kernel/DeterministicRenderFixture.ts',
  'src/app/runtime/visualizer/kernel/RenderParityHarness.ts',
  'src/app/runtime/visualizer/kernel/RenderSurface.ts',
  'src/app/runtime/visualizer/kernel/VisualControlParityManifest.ts',
  'src/app/runtime/visualizer/kernel/index.ts',
  'src/app/runtime/visualizer/session/createRuntimeFrameAuthority.ts',
  // User-provided prospective shader references; imports are read-only until approved for integration.
  'src/imports/pasted_text/cosmic-orb.tsx',
  'src/imports/pasted_text/pixel-led-display.tsx',
  'src/imports/pasted_text/blinking-squares.tsx',
  'src/imports/pasted_text/chromatic-waves.tsx',
]);

export const REQUIRED_ACTIVE_SOURCE = Object.freeze([
  'src/app/components/ui/sheet.tsx',
  'src/app/components/ui/utils.ts',
  'src/app/src/app/hooks/useKeyboardShortcuts.ts',
]);

export const ACTIVE_KEYBOARD_SHORTCUT_PATH = 'src/app/src/app/hooks/useKeyboardShortcuts.ts';
export const INACTIVE_KEYBOARD_SHORTCUT_PATH = 'src/app/hooks/useKeyboardShortcuts.ts';
