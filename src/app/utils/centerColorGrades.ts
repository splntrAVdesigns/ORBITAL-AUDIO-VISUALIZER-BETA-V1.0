import { CENTER_COLOR_STYLES, getCenterColorStyle, type CenterColorStyleId } from './centerColorStyleEngine';

export type CenterColorGradeId = CenterColorStyleId;

export type CenterColorGrade = {
  id: CenterColorGradeId;
  label: string;
  cssFilter: string;
  description: string;
};

/**
 * Backward-compatible option list for the Center Graphic select.
 * Internally these now route to the stronger luminance/alpha Color Style engine.
 */
export const CENTER_COLOR_GRADES: CenterColorGrade[] = CENTER_COLOR_STYLES.map((style) => ({
  id: style.id,
  label: style.label,
  cssFilter: style.id === 'none'
    ? 'none'
    : `contrast(${style.contrast}) brightness(${style.brightness}) saturate(${style.saturation})`,
  description: style.description,
}));

export function getCenterColorGrade(id: string | undefined | null): CenterColorGrade {
  const style = getCenterColorStyle(id);
  return {
    id: style.id,
    label: style.label,
    cssFilter: style.id === 'none'
      ? 'none'
      : `contrast(${style.contrast}) brightness(${style.brightness}) saturate(${style.saturation})`,
    description: style.description,
  };
}