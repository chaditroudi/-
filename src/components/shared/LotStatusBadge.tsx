import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  Ban,
  Package,
  Layers,
  LucideIcon,
} from "lucide-react";

export type SupportedLotStatus =
  | "STOCK_LIBERE"
  | "LIBERE"
  | "ACCEPTE"
  | "CONFORME"
  | "EN_QUARANTAINE"
  | "QUARANTAINE"
  | "STOCK_REJETE"
  | "REJETE"
  | "NON_CONFORME"
  | "BLOQUE"
  | "NON_STOCKE"
  | "EN_ATTENTE_QC"
  | "EN_QC"
  | "BROUILLON"
  | "ANNULE"
  | "free"
  | "occupied"
  | "reserved"
  | "blocked"
  | "PLANIFIE"
  | "EN_COURS"
  | "TERMINE"
  | "CLOTURE"
  | "SUSPENDU"
  | "SCELLE"
  | "EXPEDIE"
  | "normal"
  | "warning"
  | "critical"
  | string;

interface StatusMeta {
  fr: string;
  ar: string;
  icon: LucideIcon;
  variant: "emerald" | "amber" | "red" | "sky" | "slate" | "purple";
}

const STATUS_DICTIONARY: Record<string, StatusMeta> = {
  STOCK_LIBERE: { fr: "Stock libéré", ar: "مخزون محرر", icon: CheckCircle, variant: "emerald" },
  LIBERE: { fr: "Libéré", ar: "محرر", icon: CheckCircle, variant: "emerald" },
  ACCEPTE: { fr: "Accepté", ar: "مقبول", icon: ShieldCheck, variant: "emerald" },
  CONFORME: { fr: "Conforme", ar: "مطابق", icon: CheckCircle, variant: "emerald" },
  TERMINE: { fr: "Terminé", ar: "مكتمل", icon: CheckCircle, variant: "emerald" },
  CLOTURE: { fr: "Clôturé", ar: "مغلق", icon: CheckCircle, variant: "emerald" },
  SCELLE: { fr: "Scellé", ar: "مختوم", icon: Package, variant: "emerald" },
  normal: { fr: "Normal", ar: "عادي", icon: CheckCircle, variant: "emerald" },
  free: { fr: "Libre", ar: "شاغر", icon: CheckCircle, variant: "emerald" },

  EN_QUARANTAINE: { fr: "En quarantaine", ar: "في الحجر", icon: AlertTriangle, variant: "amber" },
  QUARANTAINE: { fr: "Quarantaine", ar: "حجر صحي", icon: AlertTriangle, variant: "amber" },
  EN_ATTENTE_QC: { fr: "Attente QC", ar: "في انتظار المراقبة", icon: Clock, variant: "amber" },
  EN_QC: { fr: "En cours QC", ar: "قيد المراقبة", icon: Clock, variant: "sky" },
  EN_COURS: { fr: "En cours", ar: "قيد التنفيذ", icon: Clock, variant: "sky" },
  PLANIFIE: { fr: "Planifié", ar: "مخطط", icon: Clock, variant: "slate" },
  EXPEDIE: { fr: "Expédié", ar: "تم الشحن", icon: Package, variant: "sky" },
  occupied: { fr: "Occupé", ar: "مشغول", icon: Package, variant: "sky" },
  reserved: { fr: "Réservé", ar: "محجوز", icon: Clock, variant: "amber" },
  warning: { fr: "À surveiller", ar: "تحت المراقبة", icon: AlertTriangle, variant: "amber" },

  STOCK_REJETE: { fr: "Stock rejeté", ar: "مخزون مرفوض", icon: XCircle, variant: "red" },
  REJETE: { fr: "Rejeté", ar: "مرفوض", icon: XCircle, variant: "red" },
  NON_CONFORME: { fr: "Non conforme", ar: "غير مطابق", icon: XCircle, variant: "red" },
  BLOQUE: { fr: "Bloqué", ar: "محظور", icon: Ban, variant: "red" },
  blocked: { fr: "Bloqué", ar: "محظور", icon: Ban, variant: "red" },
  critical: { fr: "Critique", ar: "حرج", icon: AlertTriangle, variant: "red" },
  SUSPENDU: { fr: "Suspendu", ar: "معلق", icon: AlertTriangle, variant: "red" },

  NON_STOCKE: { fr: "Non stocké", ar: "غير مخزن", icon: Layers, variant: "slate" },
  BROUILLON: { fr: "Brouillon", ar: "مسودة", icon: Clock, variant: "slate" },
  ANNULE: { fr: "Annulé", ar: "ملغى", icon: Ban, variant: "slate" },
};

const VARIANT_STYLES: Record<StatusMeta["variant"], string> = {
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-medium",
  amber: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-medium",
  red: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300 font-medium",
  sky: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300 font-medium",
  slate: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 font-medium",
  purple: "border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300 font-medium",
};

export interface LotStatusBadgeProps {
  status?: SupportedLotStatus | null;
  label?: string;
  showIcon?: boolean;
  size?: "xs" | "sm" | "default";
  className?: string;
}

export function getLotStatusMeta(status?: string | null, isArabic = false) {
  if (!status) {
    return {
      label: isArabic ? "غير محدد" : "—",
      icon: Clock,
      style: VARIANT_STYLES.slate,
    };
  }

  const meta = STATUS_DICTIONARY[status];
  if (meta) {
    return {
      label: isArabic ? meta.ar : meta.fr,
      icon: meta.icon,
      style: VARIANT_STYLES[meta.variant],
    };
  }

  const formatted = status.replace(/_/g, " ");
  return {
    label: formatted,
    icon: Clock,
    style: VARIANT_STYLES.slate,
  };
}

export const LotStatusBadge: React.FC<LotStatusBadgeProps> = ({
  status,
  label,
  showIcon = true,
  size = "default",
  className,
}) => {
  const { i18n } = useTranslation();
  const isArabic = i18n?.language?.startsWith("ar") || false;

  const meta = getLotStatusMeta(status, isArabic);
  const displayText = label || meta.label;
  const Icon = meta.icon;

  const sizeClasses = {
    xs: "text-xs px-1.5 py-0.5 gap-1 leading-none rounded-md",
    sm: "text-xs px-2 py-0.5 gap-1.5 leading-tight rounded-md",
    default: "text-xs px-2.5 py-1 gap-1.5 leading-normal rounded-full",
  }[size];

  return (
    <Badge
      variant="outline"
      dir={isArabic ? "rtl" : "ltr"}
      className={cn(
        "inline-flex items-center border transition-colors shadow-none select-none",
        meta.style,
        sizeClasses,
        className
      )}
    >
      {showIcon && <Icon className={cn("shrink-0", size === "xs" ? "h-2.5 w-2.5" : "h-3.5 w-3.5")} />}
      <span className="truncate">{displayText}</span>
    </Badge>
  );
};

export default LotStatusBadge;

