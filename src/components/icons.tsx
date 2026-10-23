import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = { color: ColorValue; size?: number; strokeWidth?: number };

function Icon({ color, size = 24, strokeWidth = 1.8, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {children}
    </Svg>
  );
}

export function TodayIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Circle cx={12} cy={12} r={8.5} />
      <Circle cx={12} cy={12} r={4.5} />
    </Icon>
  );
}

export function NutritionIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Path d="M12 21c-4 0-7-3.6-7-8.2C5 9.3 7.4 7 10.3 7c.9 0 1.7.4 1.7.4s.8-.4 1.7-.4C16.6 7 19 9.3 19 12.8 19 17.4 16 21 12 21zM12 7.4c0-2.2 1.1-3.7 3.2-4.4" />
    </Icon>
  );
}

export function WorkoutsIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
    </Icon>
  );
}

export function ProgressIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Path d="M4 19h16M6 15l4-4 3 3 5-6" />
    </Icon>
  );
}

export function SettingsIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <Circle cx={15} cy={7} r={2} />
      <Circle cx={9} cy={17} r={2} />
    </Icon>
  );
}

export function BarcodeIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 9v6M11 9v6M14 9v6M16.5 9v6" />
    </Icon>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Icon strokeWidth={2.2} {...p}>
      <Path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function SearchIcon(p: IconProps) {
  return (
    <Icon strokeWidth={2} {...p}>
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="M20 20l-4.2-4.2" />
    </Icon>
  );
}

export function ChevronIcon(p: IconProps) {
  return (
    <Icon strokeWidth={2} {...p}>
      <Path d="M9 6l6 6-6 6" />
    </Icon>
  );
}

export function ScaleIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <Path d="M8.5 10a3.5 3.5 0 0 1 7 0M12 10l1.5-1.5" />
    </Icon>
  );
}

export function StarIcon({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg
      width={p.size ?? 24}
      height={p.size ?? 24}
      viewBox="0 0 24 24"
      fill={filled ? p.color : 'none'}
      stroke={p.color}
      strokeWidth={1.8}
      strokeLinejoin="round">
      <Path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
    </Svg>
  );
}

export function TrophyIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4" />
    </Icon>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function TorchIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </Icon>
  );
}

export function FlameIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Path d="M12 3c2 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-7.5z" />
    </Icon>
  );
}

export function TimerIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <Circle cx={12} cy={13} r={8} />
      <Path d="M12 9v4l2.5 2.5M9 2h6" />
    </Icon>
  );
}
