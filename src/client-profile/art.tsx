import React from "react";
import type {ReactNode} from "react";
type IconName =
  | "home"
  | "qr"
  | "swap"
  | "medal"
  | "spark"
  | "arrow"
  | "chevron"
  | "close"
  | "copy"
  | "check"
  | "lock"
  | "clock"
  | "search"
  | "receipt";
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  const paths: Record<IconName, ReactNode> = {
    home: (
      <>
        <path d="m3 11 9-7 9 7" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    qr: (
      <>
        <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
        <path d="M14 14h2v2h-2zM18 14h2v6h-6v-2" />
      </>
    ),
    swap: (
      <>
        <path d="M4 7h14l-3-3M20 17H6l3 3" />
      </>
    ),
    medal: (
      <>
        <circle cx="12" cy="14" r="6" />
        <path d="m9 8-2-6h4l1 4 1-4h4l-2 6M10 14l1.2 1.2L14 12.5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 2 1.4 5.1L18 9l-4.6 1.9L12 16l-1.4-5.1L6 9l4.6-1.9z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    close: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function Brand() {
  return (
    <img
      className="brand"
      src="/assets/la-vita-logo-512.png"
      width={116}
      height={48}
      alt="La Vita Roma Condesa"
    />
  );
}

function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <span style={{ width: `${value}%` }} />
      </div>
      {label && <span className="progress-label">{label}</span>}
    </div>
  );
}

function BadgeArt({
  kind,
  state,
  compact = false,
}: {
  kind: string;
  state: string;
  compact?: boolean;
}) {
  const symbols: Record<string, ReactNode> = {
    foot: (
      <>
        <path d="M44 23c7 2 10 10 8 18-2 9-9 20-17 17-8-3-5-15-1-24 3-7 4-12 10-11Z" />
        <circle cx="37" cy="18" r="3" />
        <circle cx="43" cy="15" r="3" />
        <circle cx="49" cy="16" r="3" />
      </>
    ),
    knight: (
      <>
        <path d="M24 24h32v18c0 12-8 20-16 23-8-3-16-11-16-23Z" />
        <path d="M33 47V32c9-8 20-1 16 11-3-3-7-5-16-3M48 29l7-7" />
        <path d="M55 22c5 1 7 4 6 8-4-1-7-3-6-8Z" />
      </>
    ),
    night: (
      <>
        <path d="M22 25h36v31c-9 9-27 9-36 0Z" />
        <path d="M45 31a11 11 0 1 0 7 17 13 13 0 1 1-7-17Z" />
        <path d="m27 24 6-7 7 7 7-7 6 7" />
      </>
    ),
    taco: (
      <>
        <path d="m40 10 30 17v34L40 78 10 61V27Z" />
        <path d="M22 48c9-18 27-18 36 0-12-4-24-4-36 0Z" />
        <path d="M19 28l42 31M17 58l46-29" />
      </>
    ),
    coffee: (
      <>
        <circle cx="40" cy="40" r="31" />
        <path d="M25 31h28v17c0 9-6 14-14 14s-14-5-14-14Z" />
        <path d="M53 35h5c8 0 8 12 0 12h-5M43 22l-7 12h7l-6 12" />
      </>
    ),
    culture: (
      <>
        <ellipse cx="40" cy="40" rx="27" ry="34" />
        <path d="M24 51c4-21 14-31 31-25-11 5-11 18-3 26-9 5-19 7-28-1Z" />
        <circle cx="43" cy="31" r="5" />
        <path d="M48 31h9M23 54l-4 9h13M49 52l11 7" />
      </>
    ),
    brunch: (
      <>
        <path d="m40 8 9 19 21 3-15 15 4 21-19-10-19 10 4-21-15-15 21-3Z" />
        <path d="M24 45c9-18 23-18 32 0-10 5-22 5-32 0Z" />
        <path d="M28 38h8M44 38h8" />
      </>
    ),
    legend: (
      <>
        <circle cx="40" cy="40" r="34" />
        <circle cx="40" cy="40" r="26" />
        <path d="m20 48 7-18 13 7 12-12 8 25-16 8-12-9Z" />
        <path d="m40 30 3 7 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z" />
      </>
    ),
  };
  return (
    <div className={`badge-art ${kind} ${state} ${compact ? "compact" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 80 80">{symbols[kind]}</svg>
      {state === "locked" && (
        <span className="badge-lock">
          <Icon name="lock" size={13} />
        </span>
      )}
    </div>
  );
}

export {Icon, Brand, Progress, BadgeArt};
