import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 38,
          overflow: "hidden",
        }}
      >
        <img
          src="https://raw.githubusercontent.com/ulianzs1805/ZeonGGstore/terminal/public/zeongg-logo.webp"
          width="192"
          height="192"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    ),
    { ...size }
  );
}
