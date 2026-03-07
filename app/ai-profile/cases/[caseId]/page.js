import { buildProfileRequestHref } from "@/lib/intake";
import { getPilotCaseById, getPilotCaseLift } from "@/lib/pilot-cases";
import { ENTITY_SHORT_NAME, SITE_DOMAIN } from "@/lib/site-identity";

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

export function generateMetadata({ params }) {
  const pilotCase = getPilotCaseById(params.caseId);
  return {
    title: pilotCase ? `${pilotCase.companyName} Pilot Case | AAO` : "Pilot Case | AAO",
    description: pilotCase?.summary || "AAO pilot case detail",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function PilotCasePage({ params }) {
  const pilotCase = getPilotCaseById(params.caseId);

  if (!pilotCase) {
    return (
      <div style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.card}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>파일럿 케이스를 찾지 못했습니다.</div>
            <a href="/ai-profile" style={{ color: "#8585a0", textDecoration: "none", fontSize: 12 }}>AI profile로 돌아가기</a>
          </div>
        </div>
      </div>
    );
  }

  const rootDiagnoseHref = `/diagnose?url=${encodeURIComponent(pilotCase.rootUrl)}`;
  const profileDiagnoseHref = `/diagnose?url=${encodeURIComponent(pilotCase.profileUrl)}`;
  const requestHref = buildProfileRequestHref({
    companyName: ENTITY_SHORT_NAME,
    domain: SITE_DOMAIN,
  });
  const lift = getPilotCaseLift(pilotCase);

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <a href="/ai-profile" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#4a4a65", textDecoration: "none", fontSize: 12, marginBottom: 20 }}>
          ← AI profile로 돌아가기
        </a>

        <div style={styles.card}>
          <div style={{ fontSize: 11, color: "#4a4a65", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 10 }}>Featured Pilot Case</div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.15, fontFamily: "'Outfit',sans-serif" }}>{pilotCase.companyName} self-rollout</h1>
          <p style={{ ...styles.dim, marginTop: 12, marginBottom: 0 }}>{pilotCase.summary}</p>
          <div style={{ ...styles.dim, marginTop: 10 }}>
            측정일 {pilotCase.measurementMeasuredAt || pilotCase.baselineMeasuredAt} · source {pilotCase.baselineSource}
          </div>
        </div>

        <div style={{ ...styles.card, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {[
            { label: "Before", value: `${pilotCase.beforeScore}점`, tone: "#ffb820" },
            { label: "After", value: pilotCase.afterScore !== null ? `${pilotCase.afterScore}점` : "대기", tone: "#38bdf8" },
            { label: "Lift", value: lift !== null ? `${lift > 0 ? "+" : ""}${lift}점` : "-", tone: "#00e87b" },
            { label: "Target", value: `${pilotCase.targetScore}점`, tone: "#00e87b" },
            { label: "Status", value: pilotCase.statusLabel, tone: "#8585a0" },
          ].map((item) => (
            <div key={item.label} style={{ background: "#0e0e18", border: "1px solid #1e1e35", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 10, color: "#4a4a65", marginBottom: 6 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: item.tone, fontFamily: "'Outfit',sans-serif" }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>문제 포인트</div>
          {pilotCase.problemPoints.map((item) => (
            <div key={item} style={{ ...styles.dim, marginBottom: 6 }}>· {item}</div>
          ))}
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>개입 항목</div>
          {pilotCase.interventions.map((item) => (
            <div key={item} style={{ ...styles.dim, marginBottom: 6 }}>· {item}</div>
          ))}
        </div>

        {pilotCase.measurements && (
          <div style={styles.card}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>실측 스냅샷</div>
            <div style={{ display: "grid", gap: 12 }}>
              {Object.values(pilotCase.measurements).map((measurement) => (
                <div key={measurement.id} style={{ background: "#0e0e18", border: "1px solid #1e1e35", borderRadius: 12, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{measurement.label}</div>
                    <div style={{ fontSize: 11, color: "#8585a0" }}>{measurement.measuredAt} · {measurement.source}</div>
                  </div>
                  <div style={{ ...styles.dim, marginBottom: 8 }}>{measurement.title}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8, marginBottom: 8 }}>
                    {[
                      { label: "Score", value: `${measurement.score}점 (${measurement.grade})` },
                      { label: "PACP", value: `${measurement.axes.pacp}점` },
                      { label: "SEP", value: `${measurement.axes.sep}점` },
                      { label: "SPF", value: `${measurement.axes.spf}점` },
                    ].map((item) => (
                      <div key={item.label} style={{ background: "#121220", border: "1px solid #1e1e35", borderRadius: 10, padding: 10 }}>
                        <div style={{ fontSize: 10, color: "#4a4a65", marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={styles.dim}>· URL: {measurement.url}</div>
                  <div style={styles.dim}>· Word count: {measurement.crawl.wordCount}</div>
                  <div style={styles.dim}>· Indexability: {measurement.crawl.indexability}</div>
                  <div style={styles.dim}>· Robots meta: {measurement.crawl.robotsMeta || "없음"}</div>
                  <div style={styles.dim}>· JSON-LD / OpenGraph: {measurement.crawl.hasJsonLd ? "yes" : "no"} / {measurement.crawl.hasOpenGraph ? "yes" : "no"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>다음 마일스톤</div>
          {pilotCase.nextMilestones.map((item) => (
            <div key={item} style={{ ...styles.dim, marginBottom: 6 }}>· {item}</div>
          ))}
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>실행</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <a href={rootDiagnoseHref} style={actionButtonStyle(true)}>메인 랜딩 다시 진단</a>
            <a href={profileDiagnoseHref} style={actionButtonStyle(false)}>/ai-profile 다시 진단</a>
            <a href={requestHref} style={actionButtonStyle(false)}>요청 페이지 열기</a>
          </div>
          {pilotCase.evidence.map((item) => (
            <div key={item.label} style={{ ...styles.dim, marginBottom: 6 }}>· {item.label}: {item.value}</div>
          ))}
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
