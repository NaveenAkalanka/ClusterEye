import { cloneElement, isValidElement, useId } from "react";
import { Link } from "react-router-dom";
import { CaretDown, CaretUp, CheckCircle, Info, MagnifyingGlass, Warning } from "@phosphor-icons/react";

export function Field({ label, hint, children }) {
  const id = useId();
  const isInput = isValidElement(children) && children.type === "input";
  const isControl = isValidElement(children) && typeof children.type === "function";

  let control = children;
  if (isInput) control = cloneElement(children, { id });
  else if (isControl) control = cloneElement(children, { label: children.props.label ?? label });

  return (
    <div className="min-w-0">
      {isInput ? <label htmlFor={id} className="field-label">{label}</label> : <div className="field-label">{label}</div>}
      {control}
      {hint && <p className="mt-1.5 text-xs text-white/55">{hint}</p>}
    </div>
  );
}

const ALERT_TONES = {
  error: { icon: Warning, className: "border-alert/30 bg-alert/10 text-[#f0b8b2]" },
  caution: { icon: Warning, className: "border-caution/30 bg-caution/10 text-[#e8d3a6]" },
  success: { icon: CheckCircle, className: "border-accent/30 bg-accent/10 text-[#cfe3d2]" },
  info: { icon: Info, className: "border-line-strong bg-white/[0.04] text-white/80" },
};

export function FormAlert({ tone = "error", children, className = "" }) {
  const { icon: Icon, className: toneClass } = ALERT_TONES[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${toneClass} ${className}`}>
      <Icon size={18} weight="fill" className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SearchField({ value, onChange, label, placeholder }) {
  return (
    <div className="relative">
      <MagnifyingGlass size={16} weight="bold" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/55" aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input pl-10"
      />
    </div>
  );
}

export function ToolButton({ label, onClick, active = false, disabled = false, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={active ? `${label} (active)` : label} title={label} className={`icon-btn ${active ? "border-accent/45 text-accent" : ""}`}>
      {children}
      {active && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" aria-hidden="true" />}
    </button>
  );
}

export function SortHeader({ label, sortKey, sortConfig, onSort, className = "" }) {
  const active = sortConfig.key === sortKey;
  const descending = active && sortConfig.direction === "desc";
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}${active ? (descending ? ", descending" : ", ascending") : ""}`}
      className={`flex items-center gap-1 rounded-sm text-left text-xs font-semibold transition-colors hover:text-white ${active ? "text-white" : "text-white/70"} ${className}`}
    >
      {label}
      {active && (descending ? <CaretDown weight="bold" aria-hidden="true" /> : <CaretUp weight="bold" aria-hidden="true" />)}
    </button>
  );
}

/** While `loading`, the value is a placeholder bar so an unloaded count never reads as zero. */
export function StatCard({ label, value, primary = false, loading = false }) {
  return (
    <div className={`flex min-w-0 flex-col justify-between gap-2 rounded-xl border border-line bg-raised/75 p-3 ${primary ? "col-span-2 sm:col-span-1 lg:col-span-2" : ""}`}>
      <div className="truncate text-xs font-medium text-white/70" title={label}>{label}</div>
      {loading ? (
        <div className={`shimmer w-12 rounded bg-white/10 ${primary ? "h-6" : "h-5"}`} aria-hidden="true" />
      ) : (
        <div className={`truncate font-mono font-semibold leading-none text-white ${primary ? "text-2xl" : "text-xl"}`} title={String(value)}>{value}</div>
      )}
    </div>
  );
}

export function EmptyState({ message, action }) {
  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-4 py-10 text-center text-sm text-white/70">
      <p>{message}</p>
      {action}
    </div>
  );
}

const CLUSTER_COLORS = [
  ["#EF4444", "Red"], ["#F97316", "Orange"], ["#F59E0B", "Amber"], ["#EAB308", "Yellow"], ["#84CC16", "Lime"],
  ["#22C55E", "Green"], ["#10B981", "Emerald"], ["#14B8A6", "Teal"], ["#06B6D4", "Cyan"], ["#0EA5E9", "Sky"],
  ["#3B82F6", "Blue"], ["#6366F1", "Indigo"], ["#8B5CF6", "Violet"], ["#A855F7", "Purple"], ["#D946EF", "Fuchsia"],
  ["#EC4899", "Pink"], ["#F43F5E", "Rose"], ["#64748B", "Slate"], ["#78716C", "Stone"], ["#69639E", "Dusk"],
];

export function ClusterColorPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-5 gap-2" role="group" aria-label="Cluster Color">
      {CLUSTER_COLORS.map(([color, name]) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={name}
          aria-pressed={value === color}
          title={name}
          className={`h-9 rounded-md transition-[filter] hover:brightness-110 ${value === color ? "ring-2 ring-white ring-offset-2 ring-offset-surface" : ""}`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

/**
 * Links from a record's view to the records it's tied to. Each group is `{ label, items, empty }`,
 * and each item is `{ key, label, to, color? }`, where `to` opens that record on its own page.
 */
export function RelatedLinks({ groups }) {
  return (
    <div className="space-y-3 border-t border-line pt-4">
      <h3 className="text-sm font-medium text-white/80">Linked Records</h3>
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
          <div className="w-24 shrink-0 text-xs text-white/55">{group.label}</div>
          {group.items.length > 0 ? (
            <ul className="flex min-w-0 flex-wrap gap-1.5">
              {group.items.map((item) => (
                <li key={item.key} className="min-w-0">
                  <Link
                    to={item.to}
                    className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border border-line bg-raised px-2 text-xs font-medium text-white/85 transition-colors hover:border-line-strong hover:bg-raised-hover hover:text-white"
                  >
                    {item.color && <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />}
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-white/55">{group.empty || "None"}</p>
          )}
        </div>
      ))}
    </div>
  );
}
