import { buildProfileRequestHref } from "@/lib/intake";
import { getPilotCaseById } from "@/lib/pilot-cases";
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
    title: pilotCase ? `${pilotCase.companyName} 자체 검증 사례 | AAO` : "자체 검증 사례 | AAO",
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

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <a
          href="/ai-profile"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "#4a4a65",
            textDecoration: "none",
            fontSize: 12,
            marginBottom: 20,
          }}
        >
          ← AI profile로 돌아가기
        </a>

        <div style={styles.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "#4a4a65", letterSpacing: "1.2px", textTransform: "uppercase" }}>AAO 자체 검증 사례</div>
            <div style={{ fontSize: 11, color: "#ffb820", fontWeight: 700 }}>{pilotCase.statusLabel}</div>
          </div>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.15, fontFamily: "'Outfit',sans-serif" }}>{pilotCase.companyName} 자체 검증 리포트</h1>
          <p style={{ ...styles.dim, marginTop: 12, marginBottom: 0 }}>{pilotCase.summary}</p>
          <div style={{ ...styles.dim, marginTop: 10 }}>
            기준일 {pilotCase.updatedAt} · 설치 경로 {pilotCase.installPath}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 16 }}>
          <StateCard title="기존 메인 랜딩" state={pilotCase.beforeState} accent="#ffb820" />
          <StateCard title="공식 AI Profile 허브" state={pilotCase.afterState} accent="#38bdf8" />
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>적용한 수정</div>
          {pilotCase.appliedFixes.map((item) => (
            <div key={item} style={{ ...styles.dim, marginBottom: 6 }}>· {item}</div>
          ))}
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>관찰된 변화</div>
          {pilotCase.observedChanges.map((item) => (
            <div key={item} style={{ ...styles.dim, marginBottom: 6 }}>· {item}</div>
          ))}
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>검증 포인트</div>
          {pilotCase.proofPoints.map((item) => (
            <div key={item.label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: "#4a4a65", marginBottom: 4 }}>{item.label}</div>
              <div style={styles.dim}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>다음 액션</div>
          {pilotCase.nextSteps.map((item) => (
            <div key={item} style={{ ...styles.dim, marginBottom: 6 }}>· {item}</div>
          ))}
        </div>

        <div style={styles.card}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>실행</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href={rootDiagnoseHref} style={actionButtonStyle(true)}>메인 랜딩 다시 진단</a>
            <a href={profileDiagnoseHref} style={actionButtonStyle(false)}>/ai-profile 다시 진단</a>
            <a href={requestHref} style={actionButtonStyle(false)}>요청 페이지 열기</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function StateCard({ title, state, accent }) {
  return (
    <div style={{ ...styles.card, marginBottom: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: "#4a4a65", textTransform: "uppercase", letterSpacing: "1.1px" }}>{title}</div>
        <div style={{ fontSize: 11, color: accent, fontWeight: 700 }}>{state.label}</div>
      </div>
      <div style={{ fontSize: 12, color: "#b7b7cd", marginBottom: 8 }}>{state.url}</div>
      <div style={{ ...styles.dim, marginBottom: 12 }}>{state.summary}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(120px, 1fr))", gap: 10, marginBottom: 12 }}>
        <MiniStat label="Lint" value={`${state.lint.passed}/${state.lint.total}`} tone={accent} />
        <MiniStat label="Declared Facts" value={`${state.groundTruth.fieldCount}개`} tone="#00e87b" />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>엔진별 전달 확인</div>
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {state.engines.map((item) => (
          <div key={item.engine} style={{ background: "#0e0e18", border: "1px solid #1e1e35", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{engineLabel(item.engine)}</div>
              <div style={{ fontSize: 12, color: accent, fontWeight: 700 }}>{item.delivered}/{item.total}</div>
            </div>
            <div style={{ fontSize: 11, color: "#8585a0" }}>Citation: {citationLabel(item.citation)}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>남은 병목</div>
      {state.blockers.map((item) => (
        <div key={item} style={{ ...styles.dim, marginBottom: 6 }}>· {item}</div>
      ))}
    </div>
  );
}

function MiniStat({ label, value, tone }) {
  return (
    <div style={{ background: "#0e0e18", border: "1px solid #1e1e35", borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 10, color: "#4a4a65", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone, fontFamily: "'Outfit',sans-serif" }}>{value}</div>
    </div>
  );
}

function engineLabel(engine) {
  if (engine === "chatgpt") return "ChatGPT";
  if (engine === "gemini") return "Gemini";
  if (engine === "perplexity") return "Perplexity";
  return engine;
}

function citationLabel(citation) {
  if (citation === "exact") return "정확한 URL 일치";
  if (citation === "path") return "경로 부분 일치";
  if (citation === "host_only") return "같은 도메인";
  return "증거 없음";
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
