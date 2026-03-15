import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = { width: 1024, height: 1024 };

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1024,
          height: 1024,
          background: "#06070D",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 56,
            right: 72,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(108,99,255,0.34) 0%, rgba(108,99,255,0) 74%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 72,
            left: 52,
            width: 280,
            height: 280,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(167,139,250,0.22) 0%, rgba(167,139,250,0) 72%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 32,
            borderRadius: 220,
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 26,
          }}
        >
          <div
            style={{
              fontSize: 284,
              fontWeight: 900,
              letterSpacing: -24,
              lineHeight: 0.9,
              background: "linear-gradient(135deg, #6C63FF 0%, #A78BFA 100%)",
              backgroundClip: "text",
              color: "transparent",
              display: "flex",
              textShadow: "0 18px 48px rgba(12, 12, 25, 0.45)",
            }}
          >
            AAO
          </div>
          <div
            style={{
              padding: "12px 26px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "#ECEBFF",
              fontSize: 40,
              fontWeight: 700,
              letterSpacing: 2,
              display: "flex",
            }}
          >
            AI ANSWER OPTIMIZATION
          </div>
          <div
            style={{
              color: "#9D9AB9",
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: 5,
              display: "flex",
            }}
          >
            AI SEARCH OPTIMIZATION
          </div>
        </div>
      </div>
    ),
    size
  );
}
