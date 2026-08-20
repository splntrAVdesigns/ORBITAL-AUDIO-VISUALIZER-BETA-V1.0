import { useState } from 'react';

export function useControlPanelState() {
  const [audioSectionCollapsed, setAudioSectionCollapsed] = useState(true);
  const [colorSectionCollapsed, setColorSectionCollapsed] = useState(true);
  const [spikeRingSectionCollapsed, setSpikeRingSectionCollapsed] = useState(true);
  const [animationSectionCollapsed, setAnimationSectionCollapsed] = useState(true);
  const [dotsSectionCollapsed, setDotsSectionCollapsed] = useState(true);
  const [outerHaloSectionCollapsed, setOuterHaloSectionCollapsed] = useState(true);

  const [settingsPanelOpen, setSettingsPanelOpen] = useState<boolean>(false);
  const [performanceHUDEnabled, setPerformanceHUDEnabled] = useState<boolean>(false);

  return {
    audioSectionCollapsed,
    setAudioSectionCollapsed,
    colorSectionCollapsed,
    setColorSectionCollapsed,
    spikeRingSectionCollapsed,
    setSpikeRingSectionCollapsed,
    animationSectionCollapsed,
    setAnimationSectionCollapsed,
    dotsSectionCollapsed,
    setDotsSectionCollapsed,
    outerHaloSectionCollapsed,
    setOuterHaloSectionCollapsed,
    settingsPanelOpen,
    setSettingsPanelOpen,
    performanceHUDEnabled,
    setPerformanceHUDEnabled,
  };
}
