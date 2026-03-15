import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "AAO (AI Answer Optimization) | Official AI Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: "linear-gradient(90deg, #2563eb, #7c3aed)",
            display: "flex",
          }}
        />

        <div
          style={{
            position: "absolute",
            top: -60,
            right: -60,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
          <div
            style={{
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: 20,
              padding: "6px 16px",
              fontSize: 14,
              color: "#2563eb",
              fontWeight: 600,
              display: "flex",
            }}
          >
            Official AI Profile
          </div>
          <div
            style={{
              background: "#f5f3ff",
              border: "1px solid #ddd6fe",
              borderRadius: 20,
              padding: "6px 16px",
              fontSize: 14,
              color: "#7c3aed",
              fontWeight: 600,
              display: "flex",
            }}
          >
            Structured source hub
          </div>
        </div>

        <div
          style={{
            fontSize: 54,
            fontWeight: 900,
            letterSpacing: -1,
            marginBottom: 20,
            display: "flex",
            alignItems: "baseline",
            gap: 14,
          }}
        >
          <span style={{ color: "#2563eb" }}>AAO</span>
          <span style={{ color: "#111827", fontSize: 36, fontWeight: 700 }}>
            AI Answer Optimization
          </span>
        </div>

        <div
          style={{
            fontSize: 24,
            color: "#374151",
            lineHeight: 1.5,
            marginBottom: 48,
            maxWidth: 800,
            display: "flex",
          }}
        >
          Structured company facts, official-source policy, and AI-readable discovery
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          {[
            { num: "Visible facts", label: "Plain-text company facts in one place" },
            { num: "Aligned JSON-LD", label: "Same facts repeated in structured data" },
            { num: "Official policy", label: "Preferred source links and FAQ coverage" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: "16px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>
                {item.num}
              </span>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{item.label}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 80,
            fontSize: 15,
            color: "#9ca3af",
            display: "flex",
          }}
        >
          aao.co.kr/ai-profile
        </div>
      </div>
    ),
    { ...size }
  );
}
