import { ImageResponse } from "next/og";

const THEME_COLOR = "#0f172a";

export function createAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: THEME_COLOR,
          color: "#ffffff",
          fontSize: size * 0.55,
          fontWeight: 700,
          fontFamily: "sans-serif",
        }}
      >
        Q
      </div>
    ),
    { width: size, height: size }
  );
}
