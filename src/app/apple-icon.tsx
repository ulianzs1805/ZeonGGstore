import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090a12",
          borderRadius: 36,
          overflow: "hidden",
        }}
      >
        <img
          src="https://raw.githubusercontent.com/ulianzs1805/ZeonGGstore/terminal/public/zeongg-logo.webp"
          width="180"
          height="180"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    ),
    { ...size }
  );
}
