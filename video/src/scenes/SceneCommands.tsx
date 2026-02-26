import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { monoFont, sansFont } from "../fonts";

const COMMANDS = [
  { cmd: "odtu courses", desc: "List your courses" },
  { cmd: "odtu grades", desc: "Check your grades" },
  { cmd: "odtu deadlines", desc: "See upcoming deadlines" },
  { cmd: "odtu announcements", desc: "Read announcements" },
  { cmd: "odtu dashboard", desc: "Full overview" },
];

export const SceneCommands: React.FC = () => {
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
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,210,255,0.08) 0%, transparent 70%)",
          bottom: "10%",
          left: "10%",
          filter: "blur(100px)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            fontFamily: sansFont,
            fontSize: 48,
            fontWeight: 800,
            color: "white",
            marginBottom: 50,
            opacity: titleProgress,
          }}
        >
          Simple commands
        </div>

        {/* Command rows */}
        <div
          style={{
            background: "#0d1117",
            borderRadius: 16,
            padding: "30px 40px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {COMMANDS.map((c, i) => {
            const rowProgress = spring({
              frame: Math.max(0, frame - 8 - i * 8),
              fps,
              config: { damping: 20, stiffness: 200 },
            });

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 30,
                  marginBottom: i < COMMANDS.length - 1 ? 18 : 0,
                  opacity: rowProgress,
                  transform: `translateX(${interpolate(rowProgress, [0, 1], [40, 0])}px)`,
                }}
              >
                <span style={{ fontFamily: monoFont, fontSize: 13, color: "#7b2ff7" }}>$</span>
                <span
                  style={{
                    fontFamily: monoFont,
                    fontSize: 24,
                    color: "#00d2ff",
                    fontWeight: 700,
                    minWidth: 380,
                  }}
                >
                  {c.cmd}
                </span>
                <span
                  style={{
                    fontFamily: sansFont,
                    fontSize: 20,
                    color: "rgba(255,255,255,0.45)",
                  }}
                >
                  {c.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
