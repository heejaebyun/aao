import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AAO (AI Answer Optimization) | AI search optimization service";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#07070d",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* 배경 그라디언트 원 */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(108,99,255,0.18) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: 60,
            width: 320,
            height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(167,139,250,0.10) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              background: "rgba(108,99,255,0.15)",
              border: "1px solid rgba(108,99,255,0.35)",
              borderRadius: 20,
              padding: "6px 18px",
              fontSize: 15,
              color: "#a78bfa",
              fontWeight: 600,
              display: "flex",
            }}
          >
            AI search optimization service
          </div>
        </div>

        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: -1,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span
            style={{
              background: "linear-gradient(90deg, #6c63ff, #a78bfa)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            AAO
          </span>
          <span style={{ color: "#ccccee" }}>AI Answer Optimization</span>
        </div>

        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: "#e4e4f0",
            lineHeight: 1.3,
            marginBottom: 40,
            display: "flex",
          }}
        >
          Make your official website the primary source for AI answers
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          {[
            { num: "3 engines", label: "ChatGPT, Gemini, Perplexity" },
            { num: "2 layers", label: "Visible facts + aligned JSON-LD" },
            { num: "1 hub", label: "Official AI Profile as source page" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
                padding: "16px 28px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  background: "linear-gradient(90deg, #6c63ff, #a78bfa)",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                {item.num}
              </span>
              <span style={{ fontSize: 14, color: "#8888aa", fontWeight: 500 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 80,
            fontSize: 15,
            color: "#4a4a65",
            display: "flex",
          }}
        >
          aao.co.kr
        </div>
      </div>
    ),
    { ...size }
  );
}
