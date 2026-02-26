import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { monoFont, sansFont } from "../fonts";

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoProgress = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  const installProgress = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 200 },
  });

  const linkProgress = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: { damping: 200 },
  });

  // Pulsing glow
  const glowIntensity = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.3, 0.8]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Pulsing background glow */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(0,210,255,${0.08 * glowIntensity}) 0%, rgba(123,47,247,${0.06 * glowIntensity}) 50%, transparent 70%)`,
          filter: "blur(100px)",
        }}
      />

      {/* Big ODTU text */}
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 120,
          fontWeight: 700,
          color: "white",
          opacity: logoProgress,
          transform: `scale(${interpolate(logoProgress, [0, 1], [0.5, 1])})`,
          textShadow: `0 0 60px rgba(0,210,255,${0.4 * glowIntensity})`,
          letterSpacing: 20,
        }}
      >
        ODTU
      </div>

      {/* Install command */}
      <div
        style={{
          marginTop: 40,
          padding: "14px 30px",
          background: "rgba(255,255,255,0.05)",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          fontFamily: monoFont,
          fontSize: 28,
          opacity: installProgress,
          transform: `translateY(${interpolate(installProgress, [0, 1], [20, 0])}px)`,
        }}
      >
        <span style={{ color: "#7b2ff7" }}>$ </span>
        <span style={{ color: "#00d2ff" }}>npm install -g odtu</span>
      </div>

      {/* GitHub link */}
      <div
        style={{
          marginTop: 30,
          fontFamily: sansFont,
          fontSize: 22,
          color: "rgba(255,255,255,0.35)",
          opacity: linkProgress,
          transform: `translateY(${interpolate(linkProgress, [0, 1], [15, 0])}px)`,
        }}
      >
        github.com/ibraschwan/odtu-cli
      </div>
    </AbsoluteFill>
  );
};
