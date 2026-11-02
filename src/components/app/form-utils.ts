import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

/** Show server-side validation errors on the matching form fields. */
export function applyFieldErrors<T extends FieldValues>(fieldErrors: Record<string, string> | undefined, setError: UseFormSetError<T>) {
  if (!fieldErrors) return;
  for (const [name, message] of Object.entries(fieldErrors)) {
    setError(name as Path<T>, { type: "server", message });
  }
}
