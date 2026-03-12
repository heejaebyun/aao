import { buildProfileRequestHref, getOperationPageContent } from "@/lib/intake";
import { CONTACT_EMAIL } from "@/lib/site-identity";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#07070d",
    color: "#e4e4f0",
    fontFamily: "'Pretendard',-apple-system,sans-serif",
  },
  shell: {
    maxWidth: "920px",
    margin: "0 auto",
    padding: "28px 20px 56px",
  },
  card: {
    background: "#121220",
    borderRadius: "16px",
    padding: "20px",
    border: "1px solid #1e1e35",
    marginBottom: "16px",
  },
  dim: {
    fontSize: "12px",
    color: "#8585a0",
    lineHeight: 1.8,
  },
};

export default function AiProfileOpsPage({ channelId, searchParams = {} }) {
  const content = getOperationPageContent(channelId);

  if (!content) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.card}>
            <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "8px" }}>알 수 없는 운영 채널</div>
            <div style={styles.dim}>요청한 채널을 찾지 못했습니다.</div>
          </div>
        </div>
      </div>
    );
  }

  const companyName = searchParams.companyName || "미지정";
  const domain = searchParams.domain || "미지정";
  const plan = searchParams.plan || "미지정";
  const template = searchParams.template || "미지정";
  const draftId = searchParams.draftId || "미지정";
  const diagnoseHref = domain && domain !== "미지정" ? `/diagnose?url=${encodeURIComponent(`https://${domain}`)}` : "/diagnose";
  const requestHref = buildProfileRequestHref({
    companyName: companyName === "미지정" ? "" : companyName,
    domain: domain === "미지정" ? "" : domain,
  });

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <a href="/ai-profile/request" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#4a4a65", textDecoration: "none", fontSize: 12, marginBottom: 20 }}>
          ← 제작 요청 페이지로 돌아가기
        </a>

        <div style={styles.card}>
          <div style={{ fontSize: 11, color: "#4a4a65", textTransform: "uppercase", letterSpacing: "1.2px", marginBottom: 10 }}>AAO Ops Fallback</div>
          <h1 style={{ margin: 0, fontSize: "32px", lineHeight: 1.15, fontFamily: "'Outfit',sans-serif" }}>{content.headline}</h1>
          <p style={{ ...styles.dim, marginTop: 12, marginBottom: 0 }}>{content.description}</p>
        </div>

        <div style={{ ...styles.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          {[
            { label: "회사명", value: companyName },
            { label: "도메인", value: domain },
            { label: "플랜", value: plan },
            { label: "템플릿", value: template },
            { label: "Draft ID", value: draftId },
          ].map((item) => (
            <div key={item.label} style={{ background: "#0e0e18", border: "1px solid #1e1e35", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#4a4a65", marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{item.value || "미지정"}</div>
            </div>
          ))}
        </div>

        {content.sections.map((section) => (
          <div key={section.title} style={styles.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{section.title}</div>
            {section.items.map((item) => (
              <div key={item} style={{ ...styles.dim, marginBottom: 6 }}>· {item}</div>
            ))}
          </div>
        ))}

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>다음 액션</div>
          <div style={{ ...styles.dim, marginBottom: 14 }}>{content.note}</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={requestHref} style={actionButtonStyle(true)}>요청 정보 다시 열기</a>
            <a href={diagnoseHref} style={actionButtonStyle(false)}>도메인 다시 진단</a>
            <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`[AAO Ops] ${content.title} - ${companyName}`)}`} style={actionButtonStyle(false)}>이메일 보내기</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function actionButtonStyle(primary) {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: primary ? "linear-gradient(135deg,#ff2d55,#7928ca)" : "#0e0e18",
    color: primary ? "#fff" : "#8585a0",
    border: primary ? "none" : "1px solid #1e1e35",
    fontSize: 12,
    fontWeight: 700,
  };
}
