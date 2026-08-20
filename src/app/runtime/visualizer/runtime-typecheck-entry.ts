import { RuntimeFrameScheduler } from './RuntimeFrameScheduler';
import { VisualizerRuntimeFoundation } from './VisualizerRuntimeFoundation';
import { RuntimeAsyncRegistry } from './session/RuntimeAsyncRegistry';
import { RuntimeEventRegistry } from './session/RuntimeEventRegistry';
import { createRuntimeResourceScope } from './session/RuntimeResourceDiagnostics';
import { RuntimeSessionDisposer } from './session/RuntimeSessionDisposer';
import { RuntimeFrameEngine } from './frame/RuntimeFrameEngine';
import { createAudioRuntimeSetup } from './audio/createAudioRuntimeSetup';
import { RuntimeAudioSessionState } from './audio/RuntimeAudioSessionState';
import { createSessionInteractionSetup } from './setup/createSessionInteractionSetup';
import { createVisualEffectResources, createVisualFrameResources } from './setup/createVisualRuntimeResources';

// Compile-only API probe. This file is never imported by the application bundle.
const scope = createRuntimeResourceScope('typecheck-probe');
const disposer = new RuntimeSessionDisposer();
const asyncRegistry = new RuntimeAsyncRegistry(scope);
const eventRegistry = new RuntimeEventRegistry(scope);
const scheduler = new RuntimeFrameScheduler({ onFrame: () => {}, resourceScope: scope });
const frameEngine = new RuntimeFrameEngine({ updateFrame: () => {} });

void VisualizerRuntimeFoundation;
void asyncRegistry;
void eventRegistry;
void scheduler;
void frameEngine;
void createAudioRuntimeSetup;
void RuntimeAudioSessionState;
void createSessionInteractionSetup;
void createVisualEffectResources;
void createVisualFrameResources;
void disposer;
scope.close();
