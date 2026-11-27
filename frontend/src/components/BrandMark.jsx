export default function BrandMark({ size = 34 }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="34"
        height="34"
        rx="9"
        fill="#1E245C"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth="1.25"
      />
      <circle cx="12.5" cy="12.5" r="4" stroke="#E2E6F0" strokeWidth="1.75" />
      <circle cx="23.5" cy="12.5" r="4" stroke="#E2E6F0" strokeWidth="1.75" />
      <circle cx="12.5" cy="23.5" r="4" stroke="#E2E6F0" strokeWidth="1.75" />
      <circle cx="23.5" cy="23.5" r="4.25" fill="#F5C542" />
    </svg>
  );
}
