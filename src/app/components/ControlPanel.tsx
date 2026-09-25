import { memo, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { PlaylistTrack } from '../types/playlist';
import { ChevronDown, Settings, SkipBack, SkipForward } from 'lucide-react';
import { AstralShaperSettings } from './AstralShaperSettings';
import { CoreTexturesSettings } from './CoreTexturesSettings';
import { CenterGraphicSettings } from './CenterGraphicSettings';
import { OuterHaloSettings } from './OuterHaloSettings';
import { CoreParticlesSettings } from './CoreParticlesSettings';
import { DotsSettings } from './DotsSettings';
import { AudioTrackProgress } from './AudioTrackProgress';
import { SpikeRingSettings } from './SpikeRingSettings';
import { AnimationSettings } from './AnimationSettings';
import { ColorBPMSection } from './ColorBPMSection';
import { PresetsSection } from './PresetsSection';
import { MacrosSection } from './MacrosSection';
import { iconLogo, orbitalLogo, recoverBuiltInAssetImage } from '../config/assets';
import { markUserRequestedReload } from '../runtime/crashTelemetry';
import { probeAudioDuration } from '../runtime/audio/AudioObjectUrlRegistry';
import { AudioMetadataStrip } from './AudioMetadataStrip';
import { setControlPanelAudioTab, useControlPanelAudioTab } from '../runtime/controlPanelRuntimeStore';
import { validateAudioTrackResource } from '../config/resourceLimits';
import { safeLocalStorage } from '../utils/browserCompat';

const CONTROL_PANEL_DEBUG = Boolean((import.meta as any)?.env?.DEV && typeof window !== 'undefined' && (window as any).__ORBITAL_DEBUG_CONTROLS__);
const devLog = (...args: any[]) => { if (CONTROL_PANEL_DEBUG) console.log(...args); };
const devWarn = (...args: any[]) => { if (CONTROL_PANEL_DEBUG) console.warn(...args); };
const devError = (...args: any[]) => { if (CONTROL_PANEL_DEBUG) console.error(...args); };

const VALID_AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/aiff', 'audio/x-aiff', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/ogg', 'audio/flac']);
const isSupportedAudioFile = (file: File) => VALID_AUDIO_TYPES.has(file.type) || /\.(mp3|wav|aiff|m4a|ogg|flac)$/i.test(file.name);
const playlistBytes = (tracks: Array<{ file?: File }>) => tracks.reduce((total, track) => total + (track.file?.size ?? 0), 0);

function notePanelRender(){ if(typeof window!=='undefined') (window as any).__ORBITAL_PANEL_RENDER__?.(); }

export interface ControlPanelProps {
  animationSectionCollapsed: any;
  audioDuration: any;
  audioSectionCollapsed: any;
  autoAdvance: any;
  colorSectionCollapsed: any;
  currentTrackIndex: number;
  dotsSectionCollapsed: any;
  handleMacroChange: any;
  handleMacroCommit: any;
  isAudioPlaying: any;
  isMicActive: any;
  macroSet: any;
  macroValues: any;
  monitorEnabled: any;
  outerHaloSectionCollapsed: any;
  playlist: PlaylistTrack[];
  setAnimationSectionCollapsed: any;
  setAudioSectionCollapsed: any;
  setAutoAdvance: any;
  setColorSectionCollapsed: any;
  setCurrentTrackIndex: Dispatch<SetStateAction<number>>;
  setDotsSectionCollapsed: any;
  setMacroSet: any;
  setMonitorEnabled: any;
  setOuterHaloSectionCollapsed: any;
  setPlaylist: Dispatch<SetStateAction<PlaylistTrack[]>>;
  setSettingsPanelOpen: any;
  setShuffleEnabled: any;
  setSpikeAttackVal: any;
  setSpikeBloomVal: any;
  setSpikeCount: any;
  setSpikeMirror: any;
  setSpikeRingSectionCollapsed: any;
  setSpikeThickness: any;
  setTransientBoostVal: any;
  shuffleEnabled: any;
  spikeAttackVal: any;
  spikeBloomVal: any;
  spikeCount: any;
  spikeMirror: any;
  spikeRingSectionCollapsed: any;
  spikeThickness: any;
  transientBoostVal: any;
  useWebGL: any;
}

export const ControlPanel = memo(function ControlPanel(props: ControlPanelProps) {
  notePanelRender();
  const {
    animationSectionCollapsed,
    audioDuration,
    audioSectionCollapsed,
    autoAdvance,
    colorSectionCollapsed,
    currentTrackIndex,
    dotsSectionCollapsed,
    handleMacroChange,
    handleMacroCommit,
    isAudioPlaying,
    isMicActive,
    macroSet,
    macroValues,
    monitorEnabled,
    outerHaloSectionCollapsed,
    playlist,
    setAnimationSectionCollapsed,
    setAudioSectionCollapsed,
    setAutoAdvance,
    setColorSectionCollapsed,
    setCurrentTrackIndex,
    setDotsSectionCollapsed,
    setMacroSet,
    setMonitorEnabled,
    setOuterHaloSectionCollapsed,
    setPlaylist,
    setSettingsPanelOpen,
    setShuffleEnabled,
    setSpikeAttackVal,
    setSpikeBloomVal,
    setSpikeCount,
    setSpikeMirror,
    setSpikeRingSectionCollapsed,
    setSpikeThickness,
    setTransientBoostVal,
    shuffleEnabled,
    spikeAttackVal,
    spikeBloomVal,
    spikeCount,
    spikeMirror,
    spikeRingSectionCollapsed,
    spikeThickness,
    transientBoostVal,
    useWebGL,
  } = props;

  const audioTab = useControlPanelAudioTab();
  const setAudioTab = setControlPanelAudioTab;
  const toggleColorSection = useCallback(
    () => setColorSectionCollapsed(!colorSectionCollapsed),
    [colorSectionCollapsed, setColorSectionCollapsed],
  );
  const toggleAnimationSection = useCallback(
    () => setAnimationSectionCollapsed(!animationSectionCollapsed),
    [animationSectionCollapsed, setAnimationSectionCollapsed],
  );
  const toggleSpikeSection = useCallback(
    () => setSpikeRingSectionCollapsed(!spikeRingSectionCollapsed),
    [setSpikeRingSectionCollapsed, spikeRingSectionCollapsed],
  );
  const toggleOuterHaloSection = useCallback(
    () => setOuterHaloSectionCollapsed(!outerHaloSectionCollapsed),
    [outerHaloSectionCollapsed, setOuterHaloSectionCollapsed],
  );
  const resetAstralShaper = useCallback(() => (window as any).resetAstralShaper?.(), []);

  return (
    <aside id="panel">
      <div className="panel-fixed-regions">
      {/* PHASE 3: Control Panel Header */}
      <div className="section panel-brand-header" style={{ 
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <img 
          src={iconLogo} 
          alt="Icon"
          onError={(event) => recoverBuiltInAssetImage(event.currentTarget, 'iconLogo')} 
          style={{ 
            height: '26px',
            filter: 'none',
            objectFit: 'contain'
          }}
        />
        <img 
          src={orbitalLogo} 
          alt="ORBITAL"
          onError={(event) => recoverBuiltInAssetImage(event.currentTarget, 'orbitalLogo')} 
          style={{ 
            height: '24px',
            filter: 'none',
            objectFit: 'contain'
          }}
        />
        <div style={{ 
          fontSize: '10px', 
          fontWeight: '600', 
          color: 'rgba(30,144,255,0.6)', 
          letterSpacing: '0.5px',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap'
        }}>
          AUDIO-REACTIVE VISUALIZER ENGINE
        </div>
      </div>
      <div className="section audio-live-region" style={{ background: '#262626', border: '1px solid rgba(30,144,255,0.22)', padding: '10px 8px' }}>
        <div 
          className="collapsible-header" 
          onClick={() => setAudioSectionCollapsed(!audioSectionCollapsed)}
          style={{ marginBottom: '12px', padding: '0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <h3 style={{ margin: 0, fontSize: '11px', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--neonBlue)', fontWeight: '700' }}>AUDIO</h3>
          {/* Pink glowing dot indicator (WebGL/Canvas2D status) */}
          <span 
            title={useWebGL ? 'WebGL Active' : 'Canvas2D Fallback'}
            style={{ 
              marginLeft: 'auto',
              marginRight: '8px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#FF1493',
              boxShadow: useWebGL 
                ? '0 0 8px #FF1493, 0 0 12px rgba(255, 20, 147, 0.6)' 
                : '0 0 6px #FF1493, 0 0 8px rgba(255, 20, 147, 0.4)',
              animation: 'none',
              flexShrink: 0
            }}
          />
          {/* Green glowing dot indicator (Audio Playing / Mic Active) */}
          <span 
            title={(isAudioPlaying || isMicActive) ? (isMicActive ? 'Microphone Active' : 'Audio Playing') : 'Audio Inactive'}
            style={{ 
              marginRight: '8px',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: (isAudioPlaying || isMicActive) ? '#00FF00' : '#2a3844',
              boxShadow: (isAudioPlaying || isMicActive) 
                ? '0 0 8px #00FF00, 0 0 12px rgba(0, 255, 0, 0.6)' 
                : 'none',
              animation: 'none',
              transition: 'all 0.3s ease',
              flexShrink: 0
            }}
          />
          <span
            id="micStatusDiagnostic"
            title="Mic signal diagnostic"
            style={{
              marginRight: '8px',
              color: isMicActive ? '#00FF88' : '#536b7f',
              fontSize: '8px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              maxWidth: '88px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isMicActive ? 'mic active' : 'mic idle'}
          </span>
          <ChevronDown className={`collapsible-chevron ${audioSectionCollapsed ? 'collapsed' : ''}`} size={10} />
        </div>
        <div className={`collapsible-wrapper ${audioSectionCollapsed ? 'collapsed' : ''}`}>
          <div className="collapsible-content" style={{ padding: '0 4px' }}>
        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          gap: '0',
          marginBottom: '12px',
          background: 'rgba(30,144,255,0.05)',
          borderRadius: '6px',
          padding: '3px',
          border: '1px solid rgba(30,144,255,0.2)',
        }}>
          <button
            onClick={() => setAudioTab('controls')}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: audioTab === 'controls' 
                ? 'linear-gradient(135deg, rgba(30,144,255,0.3) 0%, rgba(138,43,226,0.3) 100%)'
                : 'transparent',
              border: audioTab === 'controls' ? '1px solid rgba(30,144,255,0.5)' : '1px solid transparent',
              borderRadius: '4px',
              color: audioTab === 'controls' ? '#1E90FF' : '#7a94aa',
              fontSize: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Audio Control
          </button>
          <button
            onClick={() => setAudioTab('playlist')}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: audioTab === 'playlist' 
                ? 'linear-gradient(135deg, rgba(30,144,255,0.3) 0%, rgba(138,43,226,0.3) 100%)'
                : 'transparent',
              border: audioTab === 'playlist' ? '1px solid rgba(30,144,255,0.5)' : '1px solid transparent',
              borderRadius: '4px',
              color: audioTab === 'playlist' ? '#1E90FF' : '#7a94aa',
              fontSize: '10px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
          >
            Playlist
            {playlist.length > 0 && (
              <span style={{
                background: 'rgba(30,144,255,0.4)',
                borderRadius: '10px',
                padding: '1px 6px',
                fontSize: '8px',
                fontWeight: '700',
              }}>
                {playlist.length}
              </span>
            )}
          </button>
        </div>
        
        <div className="audio-tab-panel" hidden={audioTab !== 'controls'} aria-hidden={audioTab !== 'controls'}>
        <div className="row" style={{ marginBottom: '8px' }}>
          <button id="mic" className="btn" style={{ fontSize: '12px' }}>Enable Mic</button>
          <label className="btn" htmlFor="file" style={{ fontSize: '12px' }}>Upload Audio</label>
          <input 
            id="file" 
            type="file" 
            multiple 
            accept="audio/mpeg,audio/mp3,audio/wav,audio/aiff,audio/mp4,audio/m4a,audio/ogg,audio/flac,.mp3,.wav,.aiff,.m4a,.ogg,.flac" 
            style={{ display: 'none' }}
            onChange={async (e) => {
              const files = e.target.files;
              devLog('📁 Files selected:', files?.length || 0);
              if (!files || files.length === 0) return;
              
              const AC = (window as any).AC;
              const loadFile = (window as any).loadFile;
              if (!AC || !loadFile) {
                devError('❌ Audio context not initialized');
                return;
              }
              
              // If multiple files, add to playlist
              if (files.length > 1) {
                devLog('📦 Multiple files detected, adding to playlist...');
                const newTracks: PlaylistTrack[] = [];
                const rejectedFiles: string[] = [];
                for (let i = 0; i < files.length; i++) {
                  const file = files[i];
                  devLog(`  File ${i}: ${file.name} (${file.type})`);
                  if (!isSupportedAudioFile(file)) {
                    devLog(`  ⚠️ Skipping invalid file: ${file.name}`);
                    rejectedFiles.push(`${file.name}: unsupported audio format`);
                    continue;
                  }
                  
                  const duration = await probeAudioDuration(file);
                  const validation = validateAudioTrackResource(file, duration, {
                    trackCount: playlist.length + newTracks.length,
                    totalBytes: playlistBytes(playlist) + playlistBytes(newTracks),
                  });
                  if (!validation.valid) {
                    rejectedFiles.push(validation.reason ?? `${file.name}: rejected`);
                    continue;
                  }
                  
                  newTracks.push({
                    id: `${Date.now()}-${i}`,
                    file,
                    name: file.name,
                    duration
                  });
                }
                
                if (newTracks.length === 0) {
                  alert(`❌ No valid audio files selected.\n\n${rejectedFiles.slice(0, 4).join('\n') || 'Accepted formats: MP3, WAV, AIFF, M4A, OGG, FLAC'}`);
                  e.target.value = '';
                  return;
                }
                if (rejectedFiles.length > 0) alert(`⚠️ Some files were skipped:\n\n${rejectedFiles.slice(0, 4).join('\n')}`);
                
                devLog('✅ New tracks created:', newTracks.length);
                
                // Add to playlist
                setPlaylist(prev => [...prev, ...newTracks]);
                
                // Auto-load first track if playlist was empty
                if (playlist.length === 0 && newTracks.length > 0) {
                  devLog('🎧 Auto-loading first track...');
                  try {
                    await AC.resume();
                    await loadFile(newTracks[0].file);
                    setCurrentTrackIndex(0);
                  } catch (err: any) {
                    devError('❌ Error loading first track:', err);
                    alert(err.message);
                  }
                }
                
                // Switch to playlist tab
                setAudioTab('playlist');
                e.target.value = '';
                return;
              }
              
              // Single file - also add to playlist for consistency
              devLog('📄 Single file detected');
              const f = files[0];
              devLog(`  File: ${f.name} (${f.type})`);
              
              // Check file type with extension fallback
              if (!isSupportedAudioFile(f)) {
                devError('❌ Invalid file type');
                alert(`❌ Invalid audio file type: ${f.name}\n\nAccepted formats: MP3, WAV, AIFF, M4A, OGG, FLAC`);
                e.target.value = '';
                return;
              }
              
              devLog('✅ File type valid, loading...');
              try {
                await AC.resume();
                
                // Get duration for single file too
                const duration = await probeAudioDuration(f);
                const validation = validateAudioTrackResource(f, duration, {
                  trackCount: playlist.length,
                  totalBytes: playlistBytes(playlist),
                });
                if (!validation.valid) throw new Error(validation.reason ?? 'Audio file rejected by resource limits.');
                
                // Create track object
                const newTrack = {
                  id: `${Date.now()}`,
                  file: f,
                  name: f.name,
                  duration
                };
                
                // Add to playlist
                setPlaylist(prev => [...prev, newTrack]);
                
                // Load the file
                await loadFile(f);
                
                // Set as current track (will be the last index after adding)
                setCurrentTrackIndex(playlist.length);
                
                devLog('✅ Single file loaded and added to playlist');
              } catch (err: any) {
                devError('❌ Error loading file:', err);
                alert(err.message);
              }
              
              e.target.value = '';
            }}
          />
          <button id="play" className="btn" title="Play/Pause">▶︎</button>
          <button id="restartAudio" className="btn" title="Restart Track">
            <SkipBack size={14} />
          </button>
          <button 
            id="skipAudio" 
            className="btn" 
            title="Skip to Next Track"
            onClick={async () => {
              if (currentTrackIndex < playlist.length - 1 && playlist.length > 0) {
                const track = playlist[currentTrackIndex + 1];
                try {
                  const AC = (window as any).AC;
                  if (AC) await AC.resume();
                  const loadFile = (window as any).loadFile;
                  if (loadFile) {
                    await loadFile(track.file);
                    setCurrentTrackIndex(currentTrackIndex + 1);
                    
                    // Re-fetch mediaEl AFTER loadFile (loadFile creates a new Audio element)
                    const mediaEl = (window as any).mediaEl;
                    
                    // Always auto-play when user clicks Skip button
                    if (mediaEl && typeof mediaEl.play === 'function') {
                      try {
                        await mediaEl.play();
                        devLog('✅ Skip: Auto-playing track:', track.name);
                      } catch (playErr) {
                        devError('❌ Skip play error:', playErr);
                      }
                    }
                  }
                } catch (err) {
                  devError('Failed to skip to next track:', err);
                }
              }
            }}
            style={{
              opacity: (currentTrackIndex < playlist.length - 1 && playlist.length > 0) ? 1 : 0.3,
              cursor: (currentTrackIndex < playlist.length - 1 && playlist.length > 0) ? 'pointer' : 'not-allowed',
            }}
          >
            <SkipForward size={14} />
          </button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '8px', color: '#7a94aa' }}>Monitor</span>
            <label className="switch" style={{ transform: 'scale(0.8)' }}><input id="monitor" type="checkbox" checked={monitorEnabled} onChange={(e) => {
              setMonitorEnabled(e.target.checked);
              (window as any).monitorEnabled = e.target.checked;
              // No updateMonitor() - audio routes directly to destination
            }} /><span className="thumb"></span></label>
          </div>
        </div>
        <AudioMetadataStrip />
        
        <div style={{ margin: '6px 0' }}>
          <canvas id="vuMeter" width="320" height="12" className="audio-level-meter" style={{ width: '100%', height: '12px', borderRadius: '2px', border: '0.5px solid var(--neonBlue)', marginBottom: '5px' }}></canvas>
          <canvas id="miniSpectrum" width="320" height="56" className="audio-spectrum-meter" style={{ width: '100%', height: '56px', borderRadius: '2px', border: '0.5px solid var(--neonBlue)' }}></canvas>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#7a94aa', fontFamily: 'monospace', marginTop: '2px', paddingLeft: '2px', paddingRight: '2px' }}>
            <span>20Hz</span>
            <span>200Hz</span>
            <span>2kHz</span>
            <span>20kHz</span>
          </div>
        </div>
        </div>
        <div className="audio-tab-panel" hidden={audioTab !== 'playlist'} aria-hidden={audioTab !== 'playlist'}>
          {/* PLAYLIST TAB */}
          <div>
            {/* Playlist Options */}
            {playlist.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '10px',
                padding: '8px',
                background: 'rgba(30,144,255,0.05)',
                borderRadius: '4px',
                border: '1px solid rgba(30,144,255,0.15)',
              }}>
                {/* LEFT SIDE: Play, Previous, Next buttons */}
                <div style={{ display: 'flex', gap: '4px', flex: '0 0 auto' }}>
                  {/* Play/Pause Button */}
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      devLog('🎵 Playlist Play button clicked, currentTrackIndex:', currentTrackIndex);
                      
                      if (currentTrackIndex < 0) {
                        devWarn('❌ No track selected');
                        return;
                      }
                      
                      // Get references
                      const AC = (window as any).AC;
                      let mediaEl = (window as any).mediaEl;
                      const loadFile = (window as any).loadFile;
                      const currentTrack = playlist[currentTrackIndex];
                      
                      devLog('🎵 Check:', {
                        hasAC: !!AC,
                        hasMediaEl: !!mediaEl,
                        hasLoadFile: !!loadFile,
                        trackName: currentTrack?.name,
                        currentTrackIndex,
                        mediaElSrc: mediaEl?.src || 'none',
                        mediaElPaused: mediaEl?.paused
                      });
                      
                      // Resume audio context first
                      if (AC) {
                        await AC.resume();
                        devLog('✅ Audio context resumed');
                      }
                      
                      // If no track loaded yet, load it first
                      if (!mediaEl || !mediaEl.src || mediaEl.src === '') {
                        devLog('📥 No track loaded, loading first...');
                        if (loadFile && currentTrack) {
                          try {
                            await loadFile(currentTrack.file);
                            
                            // Wait a bit for metadata to update
                            await new Promise(resolve => setTimeout(resolve, 150));
                            
                            // Force metadata update by checking trackMetadata from window if exposed
                            const metaSREl = document.getElementById('metaSR');
                            devLog('🔍 After load - DOM elements:', {
                              metaSR: metaSREl?.textContent
                            });
                            
                            // Re-fetch mediaEl reference after loadFile
                            mediaEl = (window as any).mediaEl;
                            
                            // Now play
                            if (mediaEl && typeof mediaEl.play === 'function') {
                              try {
                                await mediaEl.play();
                                devLog('✅ Playing track');
                              } catch (playErr) {
                                devError('❌ Play error:', playErr);
                              }
                            } else {
                              devError('❌ mediaEl not available after loadFile');
                            }
                          } catch (err) {
                            devError('❌ Error loading track:', err);
                            return;
                          }
                        } else {
                          devError('❌ loadFile or currentTrack not available');
                          return;
                        }
                      } else {
                        // Track already loaded, just toggle play/pause
                        devLog('🎵 Track already loaded, toggling play/pause');
                        if (mediaEl.paused) {
                          try {
                            await mediaEl.play();
                            devLog('✅ Playing');
                          } catch (err) {
                            devError('❌ Play error:', err);
                          }
                        } else {
                          mediaEl.pause();
                          devLog('⏸️ Paused');
                        }
                      }
                    }}
                    disabled={currentTrackIndex < 0}
                    style={{
                      fontSize: '8px',
                      padding: '4px 10px',
                      background: currentTrackIndex >= 0 ? 'rgba(30,144,255,0.3)' : 'rgba(0,0,0,0.2)',
                      border: currentTrackIndex >= 0 ? '1px solid rgba(30,144,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '3px',
                      color: currentTrackIndex >= 0 ? '#1E90FF' : '#555',
                      cursor: currentTrackIndex >= 0 ? 'pointer' : 'not-allowed',
                      fontWeight: '700',
                      transition: 'all 0.2s',
                      position: 'relative',
                      zIndex: 10,
                    }}
                    title={currentTrackIndex >= 0 ? (isAudioPlaying ? "Pause" : "Play") : "Load audio to enable playback"}
                  >
                    {isAudioPlaying ? '❚❚' : '▶'}
                  </button>
                  
                  {/* Previous Button */}
                  <button
                    onClick={async () => {
                      if (currentTrackIndex > 0) {
                        const track = playlist[currentTrackIndex - 1];
                        try {
                          const AC = (window as any).AC;
                          if (AC) await AC.resume();
                          const loadFile = (window as any).loadFile;
                          if (loadFile) {
                            await loadFile(track.file);
                            setCurrentTrackIndex(currentTrackIndex - 1);
                            
                            // Re-fetch mediaEl AFTER loadFile (loadFile creates a new Audio element)
                            const mediaEl = (window as any).mediaEl;
                            
                            // Always auto-play when user clicks Previous button
                            if (mediaEl && typeof mediaEl.play === 'function') {
                              try {
                                await mediaEl.play();
                                devLog('✅ Previous: Auto-playing track:', track.name);
                              } catch (playErr) {
                                devError('❌ Previous play error:', playErr);
                              }
                            }
                          }
                        } catch (err) {
                          devError('Failed to load previous track:', err);
                        }
                      }
                    }}
                    disabled={currentTrackIndex <= 0}
                    style={{
                      fontSize: '8px',
                      padding: '4px 8px',
                      background: currentTrackIndex > 0 ? 'rgba(30,144,255,0.2)' : 'rgba(0,0,0,0.2)',
                      border: currentTrackIndex > 0 ? '1px solid rgba(30,144,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '3px',
                      color: currentTrackIndex > 0 ? '#1E90FF' : '#555',
                      cursor: currentTrackIndex > 0 ? 'pointer' : 'not-allowed',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                    }}
                    title="Previous Track"
                  >
                    ← Prev
                  </button>
                  
                  {/* Next Button */}
                  <button
                    onClick={async () => {
                      if (currentTrackIndex < playlist.length - 1) {
                        const track = playlist[currentTrackIndex + 1];
                        try {
                          const AC = (window as any).AC;
                          if (AC) await AC.resume();
                          const loadFile = (window as any).loadFile;
                          if (loadFile) {
                            await loadFile(track.file);
                            setCurrentTrackIndex(currentTrackIndex + 1);
                            
                            // Re-fetch mediaEl AFTER loadFile (loadFile creates a new Audio element)
                            const mediaEl = (window as any).mediaEl;
                            
                            // Always auto-play when user clicks Next button
                            if (mediaEl && typeof mediaEl.play === 'function') {
                              try {
                                await mediaEl.play();
                                devLog('✅ Next: Auto-playing track:', track.name);
                              } catch (playErr) {
                                devError('❌ Next play error:', playErr);
                              }
                            }
                          }
                        } catch (err) {
                          devError('Failed to load next track:', err);
                        }
                      }
                    }}
                    disabled={currentTrackIndex >= playlist.length - 1}
                    style={{
                      fontSize: '8px',
                      padding: '4px 8px',
                      background: currentTrackIndex < playlist.length - 1 ? 'rgba(30,144,255,0.2)' : 'rgba(0,0,0,0.2)',
                      border: currentTrackIndex < playlist.length - 1 ? '1px solid rgba(30,144,255,0.4)' : '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '3px',
                      color: currentTrackIndex < playlist.length - 1 ? '#1E90FF' : '#555',
                      cursor: currentTrackIndex < playlist.length - 1 ? 'pointer' : 'not-allowed',
                      fontWeight: '600',
                      transition: 'all 0.2s',
                    }}
                    title="Next Track"
                  >
                    Next →
                  </button>
                </div>
                
                {/* RIGHT SIDE: Auto-play checkbox, Shuffle, and Clear All button */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '0 0 auto' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '9px',
                    color: '#94afc4',
                    cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={autoAdvance}
                      onChange={(e) => {
                        setAutoAdvance(e.target.checked);
                        (window as any).autoAdvance = e.target.checked; // Update window object
                        safeLocalStorage.setItem('orbital-auto-advance', String(e.target.checked));
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    Auto-play next
                  </label>
                  
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '9px',
                    color: '#94afc4',
                    cursor: 'pointer',
                  }}>
                    <input
                      type="checkbox"
                      checked={shuffleEnabled}
                      onChange={(e) => {
                        setShuffleEnabled(e.target.checked);
                        (window as any).shuffleEnabled = e.target.checked; // Update window object
                        safeLocalStorage.setItem('orbital-shuffle-enabled', String(e.target.checked));
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    Shuffle
                  </label>
                  
                  <button
                    onClick={() => {
                      if (confirm('Clear entire playlist?')) {
                        (window as any).unloadAudioFile?.();
                        setPlaylist([]);
                        setCurrentTrackIndex(-1);
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ff6b6b',
                      fontSize: '9px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,107,107,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
    
            {/* Track List */}
            <div 
              style={{
                maxHeight: '240px',
                overflowY: 'auto',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '4px',
                border: '1px solid rgba(30,144,255,0.2)',
                marginBottom: '10px',
                position: 'relative',
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.border = '2px solid rgba(30,144,255,0.6)';
                e.currentTarget.style.background = 'rgba(30,144,255,0.08)';
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.border = '1px solid rgba(30,144,255,0.2)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.currentTarget.style.border = '1px solid rgba(30,144,255,0.2)';
                e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                
                const files = e.dataTransfer.files;
                if (!files || files.length === 0) return;
                
                const newTracks: PlaylistTrack[] = [];
                const rejectedFiles: string[] = [];
                
                for (let i = 0; i < files.length; i++) {
                  const file = files[i];
                  if (!isSupportedAudioFile(file)) {
                    rejectedFiles.push(`${file.name}: unsupported audio format`);
                    continue;
                  }
                  
                  const duration = await probeAudioDuration(file);
                  const validation = validateAudioTrackResource(file, duration, {
                    trackCount: playlist.length + newTracks.length,
                    totalBytes: playlistBytes(playlist) + playlistBytes(newTracks),
                  });
                  if (!validation.valid) {
                    rejectedFiles.push(validation.reason ?? `${file.name}: rejected`);
                    continue;
                  }
                  
                  newTracks.push({
                    id: `${Date.now()}-${i}`,
                    file,
                    name: file.name,
                    duration
                  });
                }
                
                if (newTracks.length > 0) {
                  setPlaylist(prev => [...prev, ...newTracks]);
                  
                  // Auto-load first track if playlist was empty
                  if (playlist.length === 0) {
                    try {
                      const AC = (window as any).AC;
                      if (AC) await AC.resume();
                      const loadFile = (window as any).loadFile;
                      if (loadFile) {
                        await loadFile(newTracks[0].file);
                        setCurrentTrackIndex(0);
                      }
                    } catch (err) {
                      devError('Failed to load track:', err);
                    }
                  }
                }
                if (rejectedFiles.length > 0) alert(`⚠️ Some files were skipped:\n\n${rejectedFiles.slice(0, 4).join('\n')}`);
              }}
            >
              {playlist.length === 0 ? (
                <div style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  color: '#7a94aa',
                  fontSize: '10px',
                }}>
                  <div style={{ fontSize: '32px', opacity: 0.3, marginBottom: '0.5rem' }}>🎵</div>
                  <p style={{ marginBottom: '0.5rem', fontWeight: '600', color: '#94afc4' }}>No tracks in playlist</p>
                  <p style={{ fontSize: '9px', marginTop: '0.25rem', opacity: 0.7 }}>Drag & drop files here or use the Upload Audio button</p>
                  <p style={{ fontSize: '9px', marginTop: '0.5rem', color: '#1E90FF', opacity: 0.8 }}>Tip: Switch to Audio Control tab to enable microphone</p>
                </div>
              ) : (
                <>
                  {devLog('🎵 RENDERING PLAYLIST:', playlist.length, 'tracks')}
                  <div>
                  {playlist.map((track, index) => {
                    const isCurrentTrack = index === currentTrackIndex;
                    return (
                      <div
                        key={track.id}
                        style={{
                          borderBottom: index < playlist.length - 1 ? '1px solid rgba(30,144,255,0.1)' : 'none',
                          background: isCurrentTrack
                            ? 'linear-gradient(90deg, rgba(30,144,255,0.15) 0%, rgba(138,43,226,0.15) 100%)'
                            : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onClick={async () => {
                          try {
                            const AC = (window as any).AC;
                            if (AC) await AC.resume();
                            const loadFile = (window as any).loadFile;
                            if (loadFile) {
                              await loadFile(track.file);
                              setCurrentTrackIndex(index);
                            }
                          } catch (err) {
                            devError('Failed to load track:', err);
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrentTrack) {
                            e.currentTarget.style.background = 'rgba(30,144,255,0.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrentTrack) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        {/* Track Info Row */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 12px 6px 12px',
                        }}>
                          {/* Track Number */}
                          <div style={{
                            width: '20px',
                            fontSize: '10px',
                            color: isCurrentTrack ? '#1E90FF' : '#7a94aa',
                            fontWeight: '600',
                            textAlign: 'center',
                          }}>
                            {index + 1}
                          </div>
    
                          {/* Track Name */}
                          <div style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: '10px',
                            color: isCurrentTrack ? '#1E90FF' : '#b0c9dd',
                            fontWeight: isCurrentTrack ? '600' : '400',
                          }}>
                            {track.name}
                          </div>
    
                          {/* Duration */}
                          <div style={{
                            fontSize: '9px',
                            color: '#7a94aa',
                            fontFamily: 'monospace',
                          }}>
                            {track.duration > 0 ? `${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, '0')}` : '--:--'}
                          </div>
    
                          {/* Remove Button */}
                          <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newPlaylist = playlist.filter((_, i) => i !== index);
                            setPlaylist(newPlaylist);
                            if (index === currentTrackIndex) {
                              (window as any).unloadAudioFile?.();
                              setCurrentTrackIndex(-1);
                            } else if (index < currentTrackIndex) {
                              setCurrentTrackIndex(prev => prev - 1);
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#7a94aa',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '3px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '16px',
                            lineHeight: '1',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,107,107,0.2)';
                            e.currentTarget.style.color = '#ff6b6b';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#7a94aa';
                          }}
                        >
                          ×
                          </button>
                        </div>
                        
                        {/* Progress Bar (only for current track) */}
                        {isCurrentTrack && (
                          <div style={{
                            padding: '0 12px 8px 12px',
                          }}>
                            <AudioTrackProgress audioDuration={audioDuration} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                 </div>
                </>
              )}
            </div>
          </div>
        </div>
        </div>
        
        </div> {/* End collapsible-wrapper for Audio section */}
      </div> {/* End independent Audio live region */}

        {/* Phase 4.8J.1: macros/presets are a fixed control workspace, isolated from live Audio telemetry and the parameter scroller. */}
        <div className="control-workspace-fixed persistent-macros-presets" style={{ padding: '0 4px' }}>
          <MacrosSection
            macroSet={macroSet}
            macroValues={macroValues}
            onMacroSetChange={setMacroSet}
            onMacroChange={handleMacroChange}
            onMacroCommit={handleMacroCommit}
          />
          <PresetsSection />
        </div>
        
      </div> {/* End fixed header/audio/control workspace */}
      <div className="panel-scrollable parameter-scroll-region">
      {/* COLOR + BPM ADAPT */}
      <div className="panel-render-island"><ColorBPMSection
        collapsed={colorSectionCollapsed}
        onToggleCollapse={toggleColorSection}
      /></div>
      {/* ANIMATION - Collapsible Section with Gradient */}
      <div className="panel-render-island"><AnimationSettings 
        collapsed={animationSectionCollapsed}
        onToggleCollapse={toggleAnimationSection}
      /></div>
      <div className="panel-render-island"><SpikeRingSettings 
        collapsed={spikeRingSectionCollapsed}
        onToggleCollapse={toggleSpikeSection}
        spikeCount={spikeCount}
        setSpikeCount={setSpikeCount}
        spikeThickness={spikeThickness}
        setSpikeThickness={setSpikeThickness}
        spikeMirror={spikeMirror}
        setSpikeMirror={setSpikeMirror}
        spikeAttackVal={spikeAttackVal}
        setSpikeAttackVal={setSpikeAttackVal}
        spikeBloomVal={spikeBloomVal}
        setSpikeBloomVal={setSpikeBloomVal}
        transientBoostVal={transientBoostVal}
        setTransientBoostVal={setTransientBoostVal}
      >
        <DotsSettings embedded />
      </SpikeRingSettings></div>
      {/* OUTER HALO + INNER CORE - Collapsible Section */}
      <div className="panel-render-island"><OuterHaloSettings 
        collapsed={outerHaloSectionCollapsed}
        onToggleCollapse={toggleOuterHaloSection}
      /></div>
      {/* CORE PARTICLES - independent black collapsible module */}
      <div className="panel-render-island"><CoreParticlesSettings /></div>
      {/* LIQUID SHAPER - WebGL Sacred Geometry Engine */}
      <div className="panel-render-island"><AstralShaperSettings onReset={resetAstralShaper} /></div>
      {/* CORE TEXTURES - Shader preset system */}
      <div className="panel-render-island"><CoreTexturesSettings /></div>
      {/* CENTER IMAGE UPLOAD SECTION - Collapsible */}
      <div className="panel-render-island"><CenterGraphicSettings /></div>
      
      </div> {/* End panel-sticky-header */}
      
      <div className="panel-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            fontSize: '10px', 
            fontWeight: '600', 
            letterSpacing: '0.5px',
            fontFamily: 'monospace'
          }}>
            <span style={{ color: 'rgba(30,144,255,0.8)' }}>MADE BY SPLNTR</span>
            <span style={{ color: '#7a94aa' }}> - v1.0 Beta</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="panel-settings-button"
            onClick={() => setSettingsPanelOpen(true)}
            style={{
              fontSize: '9px',
              fontWeight: '600',
              color: '#7a94aa',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              transition: 'color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1E90FF'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#7a94aa'}
            title="Session Settings"
          >
            <Settings className="panel-settings-icon" size={12} />
            Settings
          </button>
          <span style={{ fontSize: '9px', color: '#4a5563' }}>•</span>
          <button
            onClick={() => {
              // Explicit user-requested reload is journaled for restart forensics.
              markUserRequestedReload('user-reload');
              window.location.reload();
            }}
            style={{
              fontSize: '9px',
              fontWeight: '600',
              color: '#7a94aa',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0',
              transition: 'color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1E90FF'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#7a94aa'}
          >
            Reload
          </button>
        </div>
      </div>
    </aside>
  );
});
