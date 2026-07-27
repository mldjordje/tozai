import clsx from "clsx";

export function PhoenixMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <g fill="currentColor">
        <path d="M30.2 24.9C24.4 20.4 16.3 15.8 5.5 11l6.8 17.2 15.4 8.2 2.5-11.5Z" />
        <path d="m27.3 34-14.9-6 5.5 12.1 11.7 5.4L27.3 34Z" />
        <path d="m29.2 43-10.8-3.4 5.9 9.2 7 4.3L29.2 43Z" />
        <path d="M33.8 24.9C39.6 20.4 47.7 15.8 58.5 11l-6.8 17.2-15.4 8.2-2.5-11.5Z" />
        <path d="m36.7 34 14.9-6-5.5 12.1-11.7 5.4 2.3-11.5Z" />
        <path d="m34.8 43 10.8-3.4-5.9 9.2-7 4.3 2.1-10.1Z" />
        <path d="m31.8 6.5 7.4 4.8-5 .6c-2.2 2.5-2.4 5.7-.8 9.5l2 4.8L32 43.8l-3.4-17.6 2-4.8c1.2-3 .9-5.5-.8-7.5l-5.3 2.4 3.2-6.4 4.1-3.4Z" />
      </g>
      <path fill="#9b7cff" d="m32 46 5.1 8.1L32 63l-5.1-8.9L32 46Z" />
    </svg>
  );
}

export default function BrandLogo({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={clsx("inline-flex items-center gap-2.5", className)}>
      <PhoenixMark className={clsx("size-7 shrink-0", markClassName)} />
      <span className="text-[0.95em] font-semibold tracking-[0.08em] text-fg">
        TOZ<span className="text-[#9b7cff]">AI</span>
      </span>
    </span>
  );
}
