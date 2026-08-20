import type { DeterministicRenderFixture } from './DeterministicRenderFixture';
import { stableSerialize } from './DeterministicRenderFixture';

export interface RenderParityProbe<TState = unknown> {
  run(fixture: DeterministicRenderFixture<any>): TState;
}

export interface RenderParityResult<TState = unknown> {
  label: string;
  equal: boolean;
  reference: TState;
  candidate: TState;
  referenceSerialized: string;
  candidateSerialized: string;
}

/**
 * Deterministic state-parity harness used before any pixel comparison.
 * Phase 4.8B intentionally compares explicit probe state, not screenshots.
 * 4.8C will attach the Offscreen host as the candidate probe.
 */
export function compareRenderParity<TState>(options: {
  fixture: DeterministicRenderFixture<any>;
  reference: RenderParityProbe<TState>;
  candidate: RenderParityProbe<TState>;
}): RenderParityResult<TState> {
  const reference = options.reference.run(options.fixture);
  const candidate = options.candidate.run(options.fixture);
  const referenceSerialized = stableSerialize(reference);
  const candidateSerialized = stableSerialize(candidate);
  return {
    label: options.fixture.label,
    equal: referenceSerialized === candidateSerialized,
    reference,
    candidate,
    referenceSerialized,
    candidateSerialized,
  };
}
