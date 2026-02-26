import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { monoFont, sansFont } from "../fonts";

export const SceneInstall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title
  const titleProgress = spring({ frame, fps, config: { damping: 200 } });

  // Terminal window
  const termProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  // Typewriter for the command
  const command = "npm install -g odtu";
  const typeStart = 0.8 * fps;
  const charsRevealed = Math.floor(
    interpolate(frame, [typeStart, typeStart + command.length * 2], [0, command.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const typedCommand = command.slice(0, charsRevealed);

  // Cursor blink
  const cursorVisible = Math.floor(frame / 8) % 2 === 0;

  // Success message after typing
  const successOpacity = interpolate(
    frame,
    [typeStart + command.length * 2 + 10, typeStart + command.length * 2 + 20],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background orb */}
      <div
        style={{
          position: "absolute",
          width: 700,
          height: 700,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,210,255,0.08) 0%, transparent 70%)",
          top: "20%",
          left: "30%",
          filter: "blur(100px)",
        }}
      />

      {/* Title */}
      <div
        style={{
          fontFamily: sansFont,
          fontSize: 48,
          fontWeight: 800,
          color: "white",
          marginBottom: 50,
          opacity: titleProgress,
          transform: `translateY(${interpolate(titleProgress, [0, 1], [-30, 0])}px)`,
        }}
      >
        One command to install
      </div>

      {/* Terminal window */}
      <div
        style={{
          width: 750,
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          opacity: termProgress,
          transform: `scale(${interpolate(termProgress, [0, 1], [0.9, 1])})`,
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: "#1e1e2e",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#28c840" }} />
          <span
            style={{
              fontFamily: sansFont,
              fontSize: 14,
              color: "rgba(255,255,255,0.4)",
              marginLeft: 12,
            }}
          >
            Terminal
          </span>
        </div>

        {/* Terminal body */}
        <div
          style={{
            background: "#0d1117",
            padding: "30px 30px",
            fontFamily: monoFont,
            fontSize: 22,
            lineHeight: 1.8,
          }}
        >
          <div>
            <span style={{ color: "#7b2ff7" }}>$</span>
            <span style={{ color: "#e6edf3" }}> {typedCommand}</span>
            {cursorVisible && charsRevealed < command.length && (
              <span style={{ color: "#00d2ff" }}>|</span>
            )}
          </div>

          {successOpacity > 0 && (
            <div style={{ opacity: successOpacity, marginTop: 10 }}>
              <span style={{ color: "#28c840" }}>+</span>
              <span style={{ color: "#8b949e" }}> odtu@1.0.0</span>
              <div style={{ marginTop: 5 }}>
                <span style={{ color: "#28c840" }}>added 120 packages</span>
                <span style={{ color: "#8b949e" }}> in 4s</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
