import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  BarChart3,
  Bot,
  Calendar,
  CheckCircle,
  Circle,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Flag,
  Folder,
  Minimize2,
  Minus,
  Moon,
  PenLine,
  Pin,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Square,
  X,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// Icon name registry — all supported icon names
// ============================================================

const iconMap: Record<string, LucideIcon> = {
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'bar-chart-3': BarChart3,
  'bot': Bot,
  'calendar': Calendar,
  'check-circle': CheckCircle,
  'circle': Circle,
  'clipboard-list': ClipboardList,
  'clock': Clock,
  'copy': Copy,
  'download': Download,
  'flag': Flag,
  'folder': Folder,
  'minus': Minus,
  'moon': Moon,
  'pen-line': PenLine,
  'pin': Pin,
  'plus': Plus,
  'refresh-cw': RefreshCw,
  'restore': Minimize2,
  'settings': Settings,
  'sparkles': Sparkles,
  'square': Square,
  'x': X,
};

/** All recognized icon names (used for type generation and tests). */
export const ICON_NAMES = Object.keys(iconMap) as IconName[];

export type IconName = keyof typeof iconMap;

// ============================================================
// Props
// ============================================================

export interface IconProps {
  /** Registered icon name. */
  name: IconName;
  /** Size in pixels (width = height). Default 20. */
  size?: number;
  /** Additional CSS class appended to the SVG. */
  className?: string;
  /** Color override (defaults to currentColor). */
  color?: string;
}

// ============================================================
// Component
// ============================================================

/**
 * Icon — thin wrapper around lucide-react icons.
 *
 * Renders a lucide SVG icon by name, forwarding size, color, and className.
 * Unknown icon names render nothing and warn in the console.
 */
export function Icon({ name, size = 20, className, color }: IconProps) {
  const LucideComponent = iconMap[name];

  if (!LucideComponent) {
    if (typeof console !== 'undefined') {
      console.warn(`[Icon] Unknown icon name: "${name}"`);
    }
    return null;
  }

  return (
    <LucideComponent
      size={size}
      color={color ?? 'currentColor'}
      className={className}
      strokeWidth={2}
      aria-hidden="true"
    />
  );
}
