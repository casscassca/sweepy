export default function DogIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Left floppy ear — tan patch, hangs down beside head */}
      <ellipse cx="14" cy="29" rx="6" ry="9" fill="#c8946a" transform="rotate(-8 14 29)" />

      {/* Right floppy ear */}
      <ellipse cx="50" cy="29" rx="6" ry="9" fill="#c8946a" transform="rotate(8 50 29)" />

      {/* Head — white */}
      <circle cx="32" cy="26" r="18" fill="#f5f0e8" />

      {/* Tan patch over left eye/ear area */}
      <ellipse cx="20" cy="20" rx="8" ry="7" fill="#d4a06a" />

      {/* Snout bump — white, slightly protruding */}
      <ellipse cx="32" cy="33" rx="8" ry="6" fill="#ede8df" />

      {/* Nose — big, black, rounded */}
      <ellipse cx="32" cy="30" rx="4" ry="3" fill="#1a1a1a" />
      {/* Nose highlight */}
      <ellipse cx="30.5" cy="29" rx="1.2" ry="0.8" fill="#444" />

      {/* Eyes — big round black with white glint, very puppet-like */}
      <circle cx="24" cy="23" r="4" fill="#1a1a1a" />
      <circle cx="40" cy="23" r="4" fill="#1a1a1a" />
      <circle cx="22.5" cy="21.5" r="1.4" fill="white" />
      <circle cx="38.5" cy="21.5" r="1.4" fill="white" />

      {/* Broom stick — diagonal, held by right paw */}
      <line x1="50" y1="34" x2="34" y2="62" stroke="#8B5E3C" strokeWidth="3" strokeLinecap="round" />

      {/* Broom head */}
      <rect x="25" y="57" width="18" height="5" rx="2.5" fill="#5a3e28" />

      {/* Bristles */}
      <line x1="27" y1="62" x2="25.5" y2="64" stroke="#7a5535" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="30" y1="62" x2="29" y2="64" stroke="#7a5535" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="33" y1="62" x2="32" y2="64" stroke="#7a5535" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="36" y1="62" x2="35" y2="64" stroke="#7a5535" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="39" y1="62" x2="38" y2="64" stroke="#7a5535" strokeWidth="1.8" strokeLinecap="round" />

      {/* Right paw holding broom */}
      <circle cx="48" cy="36" r="5" fill="#f5f0e8" />
    </svg>
  );
}
