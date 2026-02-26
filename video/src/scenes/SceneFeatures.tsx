import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate, Sequence } from "remotion";
import { sansFont, monoFont } from "../fonts";

const FEATURES = [
  { icon: "->", label: "Arrow-key selection", color: "#00d2ff" },
  { icon: ":::", label: "Dithering animations", color: "#7b2ff7" },
  { icon: "~", label: "Auto re-login", color: "#28c840" },
  { icon: "#", label: "Courses, Grades, Deadlines", color: "#febc2e" },
  { icon: "!", label: "Announcements & Forums", color: "#ff5f57" },
  { icon: "%", label: "Secure local storage", color: "#00d2ff" },
];

const FeatureRow: React.FC<{ icon: string; label: string; color: string; index: number }> = ({
  icon,
  label,
  color,
  index,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: Math.max(0, frame - index * 6),
    fps,
    config: { damping: 20, stiffness: 200 },
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        opacity: progress,
        transform: `translateX(${interpolate(progress, [0, 1], [-60, 0])}px)`,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: 12,
          background: `${color}18`,
          border: `2px solid ${color}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: monoFont,
          fontSize: 22,
          fontWeight: 700,
          color,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontFamily: sansFont,
          fontSize: 28,
          fontWeight: 600,
          color: "white",
        }}
      >
        {label}
      </span>
    </div>
  );
};

export const SceneFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background orbs */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(123,47,247,0.1) 0%, transparent 70%)",
          top: "5%",
          right: "15%",
          filter: "blur(80px)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* Title */}
        <div
          style={{
            fontFamily: sansFont,
            fontSize: 48,
            fontWeight: 800,
            color: "white",
            marginBottom: 50,
            opacity: titleProgress,
            transform: `translateY(${interpolate(titleProgress, [0, 1], [-20, 0])}px)`,
          }}
        >
          Everything you need
        </div>

        {/* Feature list */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {FEATURES.map((f, i) => (
            <FeatureRow key={i} {...f} index={i} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};
