import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-control border border-line bg-surface text-[14.5px] text-fg shadow-[0_1px_1px_rgb(11_18_16/0.03)] placeholder:text-muted/70 transition-[border,box-shadow] hover:border-line-strong focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/12 focus-visible:outline-none disabled:bg-surface-2 disabled:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/10";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(control, "h-11 px-3.5", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(control, "min-h-[88px] resize-y px-3.5 py-2.5", className)} {...props} />;
  },
);

type Option = { value: string; label: string };

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: Option[]; placeholder?: string }
>(function Select({ className, options, placeholder, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-11 cursor-pointer appearance-none pr-9 pl-3.5", className)} {...props}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
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
        className={cn(control, "h-9 cursor-pointer appearance-none rounded-full pr-8 pl-3.5 text-[13.5px] font-medium", className)}
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
  return <label className={cn("mb-1.5 block text-[13.5px] font-semibold text-fg", className)} {...props} />;
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
        <p id={`${htmlFor}-error`} className="mt-1.5 text-[12.5px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-[12.5px] text-muted">
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
      className={cn("size-[18px] shrink-0 cursor-pointer rounded-md border-line-strong accent-[var(--primary)]", className)}
      {...props}
    />
  );
}

/** Two-column responsive grid for forms (BankDash style). */
export function FormGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2", className)} {...props} />;
}
