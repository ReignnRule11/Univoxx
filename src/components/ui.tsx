import { Children, cloneElement, isValidElement, type ButtonHTMLAttributes, type HTMLAttributes, type ReactElement, type ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  lede,
  actions,
}: {
  kicker?: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {kicker ? <p className="page-kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="cluster">{actions}</div> : null}
    </header>
  );
}

export function Button({
  variant = "primary",
  block,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; block?: boolean }) {
  return <button className={`btn ${variant} ${block ? "block" : ""}`.trim()} {...props} />;
}

export function Card({
  children,
  quiet,
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { quiet?: boolean; children: ReactNode }) {
  return (
    <section className={`card${quiet ? " quiet" : ""}${className ? ` ${className}` : ""}`} {...props}>
      {children}
    </section>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: "live" | "success" | "danger" }) {
  return <span className={`badge${tone ? ` ${tone}` : ""}`}>{children}</span>;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  const control = Children.map(children, (child) => {
    if (!isValidElement(child)) {
      return child;
    }
    return cloneElement(child as ReactElement<Record<string, unknown>>, {
      id: htmlFor,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": describedBy,
    });
  });
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {control}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="lede">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="skeleton" role="status" aria-live="polite" aria-label={label}>
      <div className="skel lg" />
      <div className="skel" />
      <div className="skel" />
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="state card quiet">
      <h2>{title}</h2>
      <p>{body}</p>
      {action ? <div className="cluster" style={{ justifyContent: "center", marginTop: 16 }}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state card quiet" role="alert">
      <h2>Could not load this view</h2>
      <p>{message}</p>
      {onRetry ? (
        <div className="cluster" style={{ justifyContent: "center", marginTop: 16 }}>
          <Button type="button" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function StatusMessage({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  return (
    <p className={tone === "ok" ? "status-ok" : "status-error"} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card quiet>
      <p className="page-kicker">{label}</p>
      <p className="metric-value">{value}</p>
      {hint ? <p className="lede">{hint}</p> : null}
    </Card>
  );
}

export function MiniChart({ points }: { points: Array<{ date: string; value: number }> }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="chart" aria-hidden="true">
      {points.map((point) => (
        <span key={point.date} style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }} title={`${point.date}: ${point.value}`} />
      ))}
    </div>
  );
}

export function ConfirmBar({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className="confirm-bar" role="alertdialog" aria-label={message}>
      <span>{message}</span>
      <Button type="button" variant="danger" onClick={onConfirm} disabled={busy}>
        {confirmLabel}
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
        Keep
      </Button>
    </div>
  );
}
