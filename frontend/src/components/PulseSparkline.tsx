import { useMemo } from "react";

interface Props {
  value: number; // 0-100
  width?: number;
  height?: number;
}

export default function PulseSparkline({ value, width = 60, height = 24 }: Props) {
  const points = useMemo(() => {
    const pts: string[] = [];
    const steps = 12;
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const amp = (value / 100) * (height * 0.4);
      const y = height / 2 + Math.sin((i / steps) * Math.PI * 4 + value * 0.05) * amp;
      pts.push(`${x},${y}`);
    }
    return pts.join(" ");
  }, [value, width, height]);

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--cardiac-red))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
      />
    </svg>
  );
}
