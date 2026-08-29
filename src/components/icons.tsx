interface IconProps {
  className?: string;
}

/** Geometric knight — the ChessMaster brand mark. Single path, evenodd eye. */
export function KnightMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M6.3 20.5V14.8L4 12.6l2.8-3-.6-3.8 2.8 1.4 1.4-3.4 2.2 2.8c3.8.8 5.4 4 5.4 8v5.9H6.3Zm4.6-10.2a.85.85 0 1 1 0-1.7.85.85 0 0 1 0 1.7Z"
      />
    </svg>
  );
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4 19 19M19 5l-1.6 1.6M6.6 17.4 5 19" />
    </svg>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M20 13.6A8.2 8.2 0 1 1 10.4 4a6.6 6.6 0 0 0 9.6 9.6Z" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h11" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 12h15M13.5 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowUpRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M6.5 17.5 17.5 6.5M8.5 6.5h9v9" />
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="3.8" ry="8.5" />
      <path d="M3.8 9h16.4M3.8 15h16.4" />
    </svg>
  );
}

export function CpuIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" />
      <rect x="10" y="10" width="4" height="4" />
      <path d="M9 2.8v3M15 2.8v3M9 18.2v3M15 18.2v3M2.8 9h3M2.8 15h3M18.2 9h3M18.2 15h3" />
    </svg>
  );
}

export function BoltIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M13 2.5 4.5 14H11l-1 7.5L18.5 10H12l1-7.5Z" />
    </svg>
  );
}

export function ScopeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.8" />
      <path d="m15.6 15.6 4.9 4.9M7.8 12.6V10M10.5 12.6V7.4M13.2 12.6V9" />
    </svg>
  );
}

export function FlameIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M12 2.8c.5 2.7-1 4.2-2.3 5.7C8.4 10 7 11.8 7 14a5 5 0 0 0 10 0c0-1.5-.6-2.7-1.3-3.8-.4.7-1 1.2-1.8 1.5.4-2.9-.5-6.3-1.9-8.9Z" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.1 2.8-5 5.5-5s4.9 1.9 5.5 5M15.5 5.4a3.2 3.2 0 0 1 0 5.9M17.5 14.9c1.7.7 2.7 2.3 3 4.6" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m4.5 12.5 5.5 5.5L19.5 6.5" />
    </svg>
  );
}

export function TimerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.8 1.8M9.5 2.5h5" />
    </svg>
  );
}

export function DiamondIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 5.5 18.5 12 12 18.5 5.5 12 12 5.5Z" />
    </svg>
  );
}

export function XSocialIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.2 3.5h3l-6.6 7.6 7.8 9.4h-6.1l-4.8-5.8-5.5 5.8h-3l7.1-8.1-7.5-8.9h6.3l4.3 5.3 5.3-5.3Zm-1.1 15.2h1.7L7.7 5.2H5.9l10.2 13.5Z" />
    </svg>
  );
}

export function YoutubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="2.8" y="5.5" width="18.4" height="13" rx="3.5" />
      <path d="m10.2 9.3 4.6 2.7-4.6 2.7V9.3Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TwitchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4.5 3.5h15v9.8l-4.2 4.2h-3.5l-2.8 2.8v-2.8H4.5V3.5Z" />
      <path d="M10.3 7.5v4.5M14.8 7.5V12" />
    </svg>
  );
}

export function DiscordIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M8.5 5.2A13 13 0 0 1 12 4.8c1.2 0 2.4.1 3.5.4l1.6-1 2 4.2c1 2.6 1.4 5.4 1.2 8.3-1.6 1.3-3.4 2.1-5.3 2.5l-.9-1.8a8.6 8.6 0 0 1-4.2 0l-.9 1.8c-1.9-.4-3.7-1.2-5.3-2.5-.2-2.9.2-5.7 1.2-8.3l2-4.2 1.8 1Z" />
      <circle cx="9.4" cy="12.3" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.6" cy="12.3" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
