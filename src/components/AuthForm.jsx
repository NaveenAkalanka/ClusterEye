import { useEffect, useState } from "react";
import { Eye, EyeSlash, WarningCircle } from "@phosphor-icons/react";
import logoUrl from "../assets/ClusterEye.svg";

/** Page frame shared by Log In and Sign Up: centred card, logo, heading, and the tab title. */
export function AuthShell({ title, description, pageTitle, children, footer }) {
  useEffect(() => {
    document.title = `${pageTitle} · ClusterEye`;
    return () => { document.title = "ClusterEye"; };
  }, [pageTitle]);

  return (
    <div className="telemetry-theme flex min-h-screen min-h-dvh items-center justify-center px-4 py-8">
      <main className="telemetry-surface w-full max-w-[420px] rounded-2xl border p-6 shadow-2xl animate-panelIn md:p-7">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logoUrl} alt="" width="48" height="48" className="mb-4 size-12" />
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-white">{title}</h1>
          <p className="mt-2 text-pretty text-sm text-white/70">{description}</p>
        </div>
        {children}
        {footer && <p className="mt-6 text-center text-sm text-white/70">{footer}</p>}
      </main>
    </div>
  );
}

/**
 * A labelled auth input with a leading icon. `error` shows under the field and marks it invalid;
 * `warning` (such as Caps Lock) shows in caution colour; `hint` stays visible until either replaces it; `action` sits at the right of the label row.
 */
export function AuthField({ id, label, icon, error, warning, hint, action, trailing, inputRef, ...inputProps }) {
  const FieldIcon = icon;
  const messageId = `${id}-message`;
  const message = error || warning || hint;
  const tone = error ? "text-alert" : warning ? "text-caution" : "text-white/55";
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="field-label mb-0">{label}</label>
        {action}
      </div>
      <div className="group relative">
        <FieldIcon size={18} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${error ? "text-alert" : "text-white/55 group-focus-within:text-accent"}`} aria-hidden="true" />
        <input
          id={id}
          ref={inputRef}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          className={`input h-11 pl-10 ${trailing ? "pr-12" : ""} ${error ? "border-alert focus:border-alert" : ""}`}
          {...inputProps}
        />
        {trailing}
      </div>
      {message && (
        <p id={messageId} aria-live="polite" className={`mt-1.5 flex items-start gap-1.5 text-xs ${tone}`}>
          {(error || warning) && <WarningCircle size={14} weight="fill" className="mt-px shrink-0" aria-hidden="true" />}
          {message}
        </p>
      )}
    </div>
  );
}

/** Password field with a show/hide toggle and a Caps Lock warning. */
export function PasswordField({ hint, ...props }) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const readCaps = (e) => setCapsLock(Boolean(e.getModifierState?.("CapsLock")));

  return (
    <AuthField
      {...props}
      type={visible ? "text" : "password"}
      autoCapitalize="off"
      spellCheck={false}
      onKeyDown={readCaps}
      onKeyUp={readCaps}
      onBlur={() => setCapsLock(false)}
      warning={capsLock ? "Caps Lock is on." : undefined}
      hint={hint}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide Password" : "Show Password"}
          aria-pressed={visible}
          aria-controls={props.id}
          className="absolute right-1 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          {visible ? <EyeSlash size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      }
    />
  );
}
