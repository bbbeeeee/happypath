import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

export function ArrowIcon(props: IconProps) {
  return <Icon {...props}><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></Icon>;
}

export function BackIcon(props: IconProps) {
  return <Icon {...props}><path d="m15 18-6-6 6-6" /></Icon>;
}

export function BenchIcon(props: IconProps) {
  return <Icon {...props}><path d="M5 11h14v5H5z" /><path d="M7 16v3M17 16v3M6 8v3M18 8v3" /></Icon>;
}

export function ChevronIcon(props: IconProps) {
  return <Icon {...props}><path d="m8 10 4 4 4-4" /></Icon>;
}

export function ClockIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></Icon>;
}

export function CloseIcon(props: IconProps) {
  return <Icon {...props}><path d="m7 7 10 10M17 7 7 17" /></Icon>;
}

export function CompassIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="8" /><path d="m15 9-2 4-4 2 2-4 4-2Z" /></Icon>;
}

export function CloudRainIcon(props: IconProps) {
  return <Icon {...props}><path d="M7 17h10a4 4 0 0 0 .6-8A6 6 0 0 0 6.4 7.5 4.5 4.5 0 0 0 7 17Z" /><path d="m8 20 1-1M12 21l1-2M16 20l1-1" /></Icon>;
}

export function DropletIcon(props: IconProps) {
  return <Icon {...props}><path d="M12 3s5 5.5 5 10a5 5 0 0 1-10 0c0-4.5 5-10 5-10Z" /></Icon>;
}

export function LayersIcon(props: IconProps) {
  return <Icon {...props}><path d="m4 9 8-4 8 4-8 4-8-4Z" /><path d="m4 13 8 4 8-4M4 17l8 4 8-4" /></Icon>;
}

export function MapIcon(props: IconProps) {
  return <Icon {...props}><path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2V6Z" /><path d="M9 4v14M15 6v14" /></Icon>;
}

export function LeafIcon(props: IconProps) {
  return <Icon {...props}><path d="M19 4C10 4 5 8 5 14c0 3 2 5 5 5 6 0 9-6 9-15Z" /><path d="M5 20c2-5 6-8 11-11" /></Icon>;
}

export function LocateIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></Icon>;
}

export function MapPinIcon(props: IconProps) {
  return <Icon {...props}><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></Icon>;
}

export function RestroomIcon(props: IconProps) {
  return <Icon {...props}><circle cx="8" cy="5" r="2" /><circle cx="16" cy="5" r="2" /><path d="M5 20v-8c0-2 1-3 3-3s3 1 3 3v8M13 20l1-7c.3-2.5 1-4 2-4s1.7 1.5 2 4l1 7M3 14h8M13 14h6" /></Icon>;
}

export function RouteIcon(props: IconProps) {
  return <Icon {...props}><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h3a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3" /></Icon>;
}

export function SparkIcon(props: IconProps) {
  return <Icon {...props}><path d="m12 3 1.3 4.2L17 9l-3.7 1.8L12 15l-1.3-4.2L7 9l3.7-1.8L12 3Z" /><path d="m18 14 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z" /></Icon>;
}

export function StairsIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 18h4v-4h4v-4h4V6h4" /></Icon>;
}

export function SunIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>;
}

export function TrainIcon(props: IconProps) {
  return <Icon {...props}><rect x="6" y="3" width="12" height="15" rx="3" /><path d="M8 18l-2 3M16 18l2 3M8 13h8M9 7h6" /><circle cx="9" cy="15" r=".5" fill="currentColor" /><circle cx="15" cy="15" r=".5" fill="currentColor" /></Icon>;
}

export function UmbrellaIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 12a8 8 0 0 1 16 0H4Z" /><path d="M12 4v14a2 2 0 0 0 4 0" /><path d="M8 12c0-2 1.8-3.5 4-3.5s4 1.5 4 3.5" /></Icon>;
}
