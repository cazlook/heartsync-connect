import { Heart, Zap, Timer } from "lucide-react";

interface Props {
  reciprocity: number;
  intensity: number;
  synchrony: number;
  total: number;
  size?: "sm" | "md";
}

export default function CardiacScoreBadge({ reciprocity, intensity, synchrony, total, size = "md" }: Props) {
  const isSmall = size === "sm";

  return (
    <div className="glass-panel px-3 py-2 flex items-center gap-3">
      <div className={`font-mono-data font-semibold ${isSmall ? "text-lg" : "text-2xl"} text-primary`}>
        {total}
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Heart size={10} /> Reciprocità
          </span>
          <span className="font-mono-data text-foreground">{reciprocity}/50</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Zap size={10} /> Intensità
          </span>
          <span className="font-mono-data text-foreground">{intensity}/30</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Timer size={10} /> Sincronia
          </span>
          <span className="font-mono-data text-foreground">{synchrony}/20</span>
        </div>
      </div>
    </div>
  );
}
