import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-control border border-line bg-surface-2 text-[15px] text-fg placeholder:text-muted transition-colors hover:border-line-strong focus-visible:border-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(control, "h-[50px] px-4", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(control, "min-h-[96px] resize-y px-4 py-3", className)} {...props} />;
  },
);

type Option = { value: string; label: string };

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }
>(function Select({ className, options, placeholder, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-[50px] cursor-pointer appearance-none pr-10 pl-4", className)} {...props}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
});

/** Compact select for toolbars and filters. */
export function FilterSelect({
  className,
  options,
  placeholder,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder: string }) {
  return (
    <div className="relative">
      <select
        className={cn(control, "h-10 cursor-pointer appearance-none rounded-full bg-surface pr-9 pl-4 text-sm", className)}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-2 block text-[15px] font-medium text-fg", className)} {...props} />;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn("min-w-0", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
      </Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
            id: htmlFor,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": describedBy,
          })
        : children}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-[13px] text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("size-5 shrink-0 cursor-pointer rounded-md border-line-strong accent-[var(--accent)]", className)}
      {...props}
    />
  );
}

/** Two-column responsive grid for forms (BankDash style). */
export function FormGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2", className)} {...props} />;
}
