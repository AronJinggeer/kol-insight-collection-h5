import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type SectionCardProps = {
  eyebrow: string;
  title: string;
  description?: string;
  children?: ReactNode;
};

export function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: SectionCardProps) {
  return (
    <section className="card-surface soft-border rounded-[28px] p-6 shadow-card sm:p-8">
      <div className="mb-6 space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-sage">
          {eyebrow}
        </p>
        <div className="space-y-2">
          <h2 className="font-display text-[28px] leading-tight text-ink sm:text-[32px]">
            {title}
          </h2>
          {description ? (
            <p className="max-w-2xl text-sm leading-7 text-muted sm:text-[15px]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

type FieldShellProps = {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FieldShell({
  label,
  required,
  hint,
  error,
  children,
}: FieldShellProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-[15px] font-semibold text-ink">
          {label}
          {required ? <span className="ml-1 text-accent">*</span> : null}
        </label>
        {hint ? <p className="text-sm text-muted">{hint}</p> : null}
      </div>
      {children}
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </div>
  );
}

type PillOptionProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
  type?: "checkbox" | "radio";
};

export function PillOption({
  label,
  checked,
  disabled,
  onClick,
  type = "checkbox",
}: PillOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "field-transition flex min-h-12 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm",
        checked
          ? "border-moss bg-moss text-white shadow-sm"
          : "border-line bg-white/70 text-ink hover:-translate-y-0.5 hover:border-sage hover:bg-white",
        disabled && !checked ? "cursor-not-allowed opacity-45 hover:translate-y-0" : "",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px]",
          checked
            ? "border-white/70 bg-white/15 text-white"
            : "border-stone-300 text-stone-400",
          type === "checkbox" ? "rounded-md" : "rounded-full",
        )}
      >
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput(props: InputProps) {
  return (
    <input
      {...props}
      className={cn(
        "field-transition w-full rounded-2xl border border-line bg-white/80 px-4 py-3 text-[15px] text-ink placeholder:text-stone-400",
        props.className,
      )}
    />
  );
}

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
};

export function PrimaryButton({
  children,
  className,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "field-transition inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white hover:-translate-y-0.5 hover:bg-moss disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
        className,
      )}
    >
      {children}
    </button>
  );
}
