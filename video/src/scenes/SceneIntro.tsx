import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import { monoFont, sansFont } from "../fonts";

const BANNER_LINES = [
  "                          :",
  " :                       ::          ___       ___       ___       ___",
  " ::          :          ::          /\\  \\     /\\  \\     /\\  \\     /\\__\\",
  ":::  ::     ::         :::         /::\\  \\   /::\\  \\    \\:\\  \\   /:/ _/_",
  ":::::::    :::::::::::::::        /:/\\:\\__\\ /:/\\:\\__\\   /::\\__\\ /:/_/\\__\\",
  " ::::::::::::::::::::::::         \\:\\/:/  / \\:\\/:/  /  /:/\\/__/ \\:\\/:/  /",
  " :::::::::::::::::::::             \\::/  /   \\::/  /   \\/__/     \\::/  /",
  "         :::::                      \\/__/     \\/__/               \\/__/",
  "         :::",
  "         :::",
  "        ::::",
];

// Collect all non-space positions, shuffled deterministically
function getDitherPositions(lines: string[]): [number, number][] {
  const positions: [number, number][] = [];
  for (let row = 0; row < lines.length; row++) {
    for (let col = 0; col < lines[row].length; col++) {
      if (lines[row][col] !== " ") {
        positions.push([row, col]);
      }
    }
  }
  // Deterministic shuffle using a simple seed-based approach
  let seed = 42;
  for (let i = positions.length - 1; i > 0; i--) {
    seed = (seed * 16807 + 0) % 2147483647;
    const j = seed % (i + 1);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions;
}

const ditherPositions = getDitherPositions(BANNER_LINES);

export const SceneIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Dithering: reveal chars over first 2 seconds
  const ditherEnd = 2 * fps;
  const revealedCount = Math.floor(
    interpolate(frame, [0, ditherEnd], [0, ditherPositions.length], {
      extrapolateRight: "clamp",
    })
  );

  // Build the grid
  const maxLen = Math.max(...BANNER_LINES.map((l) => l.length));
  const grid = BANNER_LINES.map(() => new Array(maxLen).fill(" "));
  for (let i = 0; i < revealedCount; i++) {
    const [row, col] = ditherPositions[i];
    grid[row][col] = BANNER_LINES[row][col];
  }
  const bannerText = grid.map((row) => row.join("")).join("\n");

  // Tagline fade in after banner completes
  const taglineOpacity = interpolate(frame, [ditherEnd, ditherEnd + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle spring in
  const subtitleProgress = spring({
    frame: Math.max(0, frame - ditherEnd - 15),
    fps,
    config: { damping: 200 },
  });

  // Glow pulse on the banner
  const glowOpacity = frame > ditherEnd
    ? interpolate(frame, [ditherEnd, ditherEnd + 30], [0, 0.6], {
        extrapolateRight: "clamp",
      })
    : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0a0f",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Background gradient orbs */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,210,255,0.12) 0%, transparent 70%)",
          top: "10%",
          left: "10%",
          filter: "blur(80px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(123,47,247,0.12) 0%, transparent 70%)",
          bottom: "10%",
          right: "10%",
          filter: "blur(80px)",
        }}
      />

      {/* ASCII Banner */}
      <pre
        style={{
          fontFamily: monoFont,
          fontSize: 18,
          lineHeight: 1.3,
          color: "#00d2ff",
          textShadow: `0 0 ${20 * glowOpacity}px rgba(0,210,255,${glowOpacity})`,
          whiteSpace: "pre",
          textAlign: "left",
        }}
      >
        {bannerText}
      </pre>

      {/* Tagline */}
      <div
        style={{
          marginTop: 10,
          fontFamily: monoFont,
          fontSize: 16,
          color: "rgba(255,255,255,0.4)",
          opacity: taglineOpacity,
          letterSpacing: 1,
        }}
      >
        welcome to odtu cli v1.0 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; built with {"<3"} by ibracob.dev
      </div>

      {/* Subtitle */}
      <div
        style={{
          marginTop: 40,
          fontFamily: sansFont,
          fontSize: 36,
          fontWeight: 600,
          color: "white",
          opacity: subtitleProgress,
          transform: `translateY(${interpolate(subtitleProgress, [0, 1], [30, 0])}px)`,
        }}
      >
        Your METU courses, right in the terminal.
      </div>
    </AbsoluteFill>
  );
};
