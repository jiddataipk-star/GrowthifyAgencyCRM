import { cn, initials } from "@/lib/utils";

/** Image avatar with an initials fallback. Plain <img>: sources are arbitrary CDNs. */
export function Avatar({
  src,
  name,
  size = 40,
  className,
  square,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  square?: boolean;
}) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) };
  const shape = square ? "rounded-[14px]" : "rounded-full";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={cn("shrink-0 border border-line bg-surface-2 object-cover", shape, className)}
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary-tint font-display font-bold text-primary",
        shape,
        className,
      )}
      style={style}
    >
      {initials(name)}
    </span>
  );
}
