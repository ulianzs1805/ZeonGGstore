import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const LOGO_URL = "https://raw.githubusercontent.com/ulianzs1805/ZeonGGstore/terminal/public/AFED0327-AB02-4E23-9FCC-B94940A08A4C.png";

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
          src={LOGO_URL}
          width="180"
          height="180"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
    ),
    { ...size }
  );
}
