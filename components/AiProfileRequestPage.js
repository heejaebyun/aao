"use client";

import { useEffect, useState } from "react";
import {
  AUTO_TEMPLATE_ID,
  AI_PROFILE_PLANS,
  HOSTING_OPTIONS,
  INDUSTRY_TEMPLATE_LIBRARY,
  INSTALL_SUPPORT_OPTIONS,
  PILOT_SLA_BY_PLAN,
  PROFILE_REQUEST_SNAPSHOT_KEY,
  buildDiagnosticSnapshot,
  getCommercialChannelCatalog,
  getIndustryTemplateById,
  getInstallationSop,
  resolveIndustryTemplateId,
} from "@/lib/intake";
import { buildPilotCaseHref, getFeaturedPilotCase } from "@/lib/pilot-cases";

const C = {
  bg: "#07070d",
  surface: "#0e0e18",
  card: "#121220",
  border: "#1e1e35",
  text: "#e4e4f0",
  textMuted: "#8585a0",
  textDim: "#4a4a65",
  accent: "#ff2d55",
  g1: "#ff2d55",
  g2: "#7928ca",
  success: "#00e87b",
  successBg: "rgba(0,232,123,0.08)",
  warning: "#ffb820",
  warningBg: "rgba(255,184,32,0.08)",
  info: "#38bdf8",
  infoBg: "rgba(56,189,248,0.08)",
  danger: "#ff3b4f",
  dangerBg: "rgba(255,59,79,0.08)",
};

const EMPTY_FORM = {
  contactName: "",
  contactEmail: "",
  phone: "",
  companyName: "",
  domain: "",
  industry: "",
  representative: "",
  mainService: "",
  materials: "",
  notes: "",
  timeline: "가능하면 이번 달 안에 진행하고 싶습니다.",
  planId: "basic",
  templateId: AUTO_TEMPLATE_ID,
  hostingType: "other",
  installSupport: "guided",
};

export default function AiProfileRequestPage({ initialQuery = {} }) {
  const featuredCase = getFeaturedPilotCase();
  const [snapshot, setSnapshot] = useState(() => buildDiagnosticSnapshot());
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const querySnapshot = buildDiagnosticSnapshot({
      companyName: initialQuery.companyName,
      domain: initialQuery.domain,
      url: initialQuery.url,
      score: initialQuery.score,
      targetScore: initialQuery.targetScore,
    });

    let storedSnapshot = {};
    try {
      const raw = window.sessionStorage.getItem(PROFILE_REQUEST_SNAPSHOT_KEY);
      storedSnapshot = raw ? JSON.parse(raw) : {};
    } catch {
      storedSnapshot = {};
    }

    const mergedSnapshot = buildDiagnosticSnapshot({
      ...querySnapshot,
      ...storedSnapshot,
    });

    setSnapshot(mergedSnapshot);
    setForm((prev) => ({
      ...prev,
      companyName: prev.companyName || mergedSnapshot.companyName || "",
      domain: prev.domain || mergedSnapshot.domain || "",
    }));
  }, [initialQuery.companyName, initialQuery.domain, initialQuery.score, initialQuery.targetScore, initialQuery.url]);

  const selectedPlan = AI_PROFILE_PLANS.find((plan) => plan.id === form.planId) || AI_PROFILE_PLANS[0];
  const resolvedTemplateId = resolveIndustryTemplateId({
    templateId: form.templateId,
    industry: form.industry,
    mainService: form.mainService,
    headline: snapshot.headline,
  });
  const selectedTemplate = getIndustryTemplateById(resolvedTemplateId);
  const selectedSop = getInstallationSop(form.hostingType, form.installSupport);
  const commercialChannels = getCommercialChannelCatalog();
  const previewBeforeScore = snapshot.currentScore;
  const previewAfterScore =
    snapshot.targetScore !== null && snapshot.targetScore !== undefined
      ? snapshot.targetScore
      : null;
  const previewPilotSla = PILOT_SLA_BY_PLAN[selectedPlan.id] || PILOT_SLA_BY_PLAN.basic;
  const previewStageFlow = getPreviewPilotStages();
  const previewCaseStudy = getPreviewCaseStudy({
    companyName: form.companyName || snapshot.companyName,
    beforeScore: previewBeforeScore,
    afterScore: previewAfterScore,
    templateLabel: selectedTemplate.label,
    planLabel: selectedPlan.label,
  });

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    setSubmitError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setSubmitError("");
    setFieldErrors({});
    setResult(null);

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          snapshot,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFieldErrors(data.fieldErrors || {});
        throw new Error(data.error || "문의 초안 생성에 실패했습니다.");
      }

      setResult(data.intake);
      try {
        window.sessionStorage.setItem(PROFILE_REQUEST_SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch {}
    } catch (error) {
      setSubmitError(error.message || "문의 초안 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(kind, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  }

  function downloadMarkdown() {
    if (!result?.markdown) return;

    const blob = new Blob([result.markdown], { type: "text/markdown;charset=utf-8" });
    const fileName = `${(result.request?.companyName || result.request?.domain || "aao-intake").replace(/\s+/g, "-").toLowerCase()}-aao-intake.md`;
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Pretendard',-apple-system,sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 56px" }}>
        <a href="/diagnose" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: C.textDim, textDecoration: "none", fontSize: 12, marginBottom: 20 }}>
          ← 진단 화면으로 돌아가기
        </a>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
          <div>
            <div style={{ background: C.card, borderRadius: 18, padding: 22, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.textDim, letterSpacing: "1.3px", textTransform: "uppercase", marginBottom: 10 }}>
                Phase 1.5 · Commercialization Layer
              </div>
              <h1 style={{ margin: 0, fontFamily: "'Outfit',sans-serif", fontSize: 34, lineHeight: 1.15, letterSpacing: "-1.4px" }}>
                AI 프로필 페이지 제작 요청
              </h1>
              <p style={{ marginTop: 12, marginBottom: 0, fontSize: 14, color: C.textMuted, lineHeight: 1.8 }}>
                진단 결과를 기준으로 `문제 발견 → 제작 요청 → 설치 → Before/After 재진단` 흐름을 바로 시작하는 폼입니다.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
              {[
                { label: "현재 점수", value: snapshot.currentScore !== null ? `${snapshot.currentScore}점` : "미측정", color: C.warning },
                { label: "목표 점수", value: previewAfterScore !== null ? `${previewAfterScore}점` : "설치 후 측정", color: C.success },
                { label: "Gap", value: snapshot.gapScore !== null ? `+${snapshot.gapScore}점` : "—", color: C.info },
                { label: "설치 경로", value: "/ai-profile", color: C.text },
              ].map((item) => (
                <div key={item.label} style={{ background: C.card, borderRadius: 14, padding: 16, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>{item.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: item.color, fontFamily: "'Outfit',sans-serif" }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>업종별 템플릿 라이브러리</div>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8, marginBottom: 12 }}>
                업종에 맞는 섹션 구조와 Schema 조합을 미리 고르면 초안 품질이 더 안정적입니다.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => updateField("templateId", AUTO_TEMPLATE_ID)}
                  style={templateCardStyle(form.templateId === AUTO_TEMPLATE_ID)}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>자동 추천</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>현재 입력 기준으로 `{selectedTemplate.label}` 적용</div>
                </button>
                {INDUSTRY_TEMPLATE_LIBRARY.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => updateField("templateId", template.id)}
                    style={templateCardStyle(resolvedTemplateId === template.id && form.templateId !== AUTO_TEMPLATE_ID)}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{template.label}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4, lineHeight: 1.6 }}>{template.sections.slice(0, 2).join(" · ")}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 12, padding: 14, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{selectedTemplate.label}</div>
                  <div style={{ fontSize: 11, color: C.warning, fontWeight: 700 }}>템플릿 가이드 +{selectedTemplate.targetLift}점</div>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8, marginBottom: 10 }}>{selectedTemplate.summary}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
                  <TemplateList title="핵심 섹션" items={selectedTemplate.sections} />
                  <TemplateList title="필수 자료" items={selectedTemplate.requiredAssets} />
                  <TemplateList title="출처 타깃" items={selectedTemplate.sourceTargets} />
                </div>
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>진단 스냅샷</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{snapshot.companyName || form.companyName || "회사명 미입력"}</div>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{snapshot.domain || form.domain || "도메인 미입력"}</div>
              </div>
              <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.8 }}>
                {snapshot.headline || "직전 진단 스냅샷이 없으면 아래 폼만 입력해도 요청 초안을 만들 수 있습니다."}
              </div>
              {snapshot.detail && (
                <div style={{ marginTop: 10, fontSize: 12, color: C.textDim, lineHeight: 1.7 }}>
                  {snapshot.detail}
                </div>
              )}
              {(snapshot.pacpScore !== null || snapshot.sepScore !== null || snapshot.spfScore !== null) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 12 }}>
                  {[
                    { label: "PACP", value: snapshot.pacpScore, max: 40, color: "#ff6b35" },
                    { label: "SEP", value: snapshot.sepScore, max: 30, color: "#38bdf8" },
                    { label: "SPF", value: snapshot.spfScore, max: 30, color: "#a855f7" },
                  ].map((axis) => (
                    <div key={axis.label} style={{ background: C.surface, borderRadius: 10, padding: 12, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, color: C.textDim }}>{axis.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: axis.color, fontFamily: "'Outfit',sans-serif" }}>
                        {axis.value !== null ? `${axis.value}/${axis.max}` : "—"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>제작 요청 정보</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <Field label="담당자명" error={fieldErrors.contactName}>
                  <input value={form.contactName} onChange={(e) => updateField("contactName", e.target.value)} style={inputStyle(fieldErrors.contactName)} />
                </Field>
                <Field label="이메일" error={fieldErrors.contactEmail}>
                  <input type="email" value={form.contactEmail} onChange={(e) => updateField("contactEmail", e.target.value)} style={inputStyle(fieldErrors.contactEmail)} />
                </Field>
                <Field label="연락처">
                  <input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} style={inputStyle()} />
                </Field>
                <Field label="회사명" error={fieldErrors.companyName}>
                  <input value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} style={inputStyle(fieldErrors.companyName)} />
                </Field>
                <Field label="도메인" error={fieldErrors.domain}>
                  <input value={form.domain} onChange={(e) => updateField("domain", e.target.value)} style={inputStyle(fieldErrors.domain)} />
                </Field>
                <Field label="업종">
                  <input value={form.industry} onChange={(e) => updateField("industry", e.target.value)} style={inputStyle()} />
                </Field>
                <Field label="대표자">
                  <input value={form.representative} onChange={(e) => updateField("representative", e.target.value)} style={inputStyle()} />
                </Field>
                <Field label="희망 시점">
                  <input value={form.timeline} onChange={(e) => updateField("timeline", e.target.value)} style={inputStyle()} />
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Field label="주요 서비스 / 제품" error={fieldErrors.mainService}>
                  <textarea value={form.mainService} onChange={(e) => updateField("mainService", e.target.value)} style={textareaStyle(fieldErrors.mainService)} rows={3} />
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Field label="보유 자료 / 참고 링크">
                  <textarea value={form.materials} onChange={(e) => updateField("materials", e.target.value)} style={textareaStyle()} rows={4} placeholder="회사소개서, 사업자등록증, 포트폴리오, 인스타/유튜브 링크 등을 넣어주세요." />
                </Field>
              </div>

              <div style={{ marginTop: 12 }}>
                <Field label="추가 메모">
                  <textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} style={textareaStyle()} rows={3} placeholder="꼭 넣고 싶은 문장, 경쟁사, 설치 제약이 있으면 적어주세요." />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 12 }}>
                <Field label="플랜">
                  <select value={form.planId} onChange={(e) => updateField("planId", e.target.value)} style={selectStyle()}>
                    {AI_PROFILE_PLANS.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.label} · {plan.priceLabel}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="호스팅 환경">
                  <select value={form.hostingType} onChange={(e) => updateField("hostingType", e.target.value)} style={selectStyle()}>
                    {HOSTING_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="설치 지원">
                  <select value={form.installSupport} onChange={(e) => updateField("installSupport", e.target.value)} style={selectStyle()}>
                    {INSTALL_SUPPORT_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {submitError && (
                <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: C.dangerBg, border: `1px solid ${C.danger}30`, color: C.danger, fontSize: 12 }}>
                  {submitError}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
                <button type="submit" disabled={loading} style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  cursor: loading ? "wait" : "pointer",
                  background: `linear-gradient(135deg,${C.g1},${C.g2})`,
                  color: "#fff",
                  fontWeight: 700,
                  fontFamily: "'Outfit',sans-serif",
                }}>
                  {loading ? "초안 생성 중..." : "문의 초안 생성"}
                </button>
                <a href="/ai-profile" style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  color: C.textMuted,
                  textDecoration: "none",
                  fontSize: 13,
                  display: "inline-flex",
                  alignItems: "center",
                }}>
                  AI 프로필 예시 보기
                </a>
              </div>
            </form>
          </div>

          <div>
            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16, position: "sticky", top: 18 }}>
              <div style={{ fontSize: 12, color: C.textDim, marginBottom: 10 }}>선택한 플랜</div>
              <div style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Outfit',sans-serif", marginBottom: 4 }}>{selectedPlan.label}</div>
              <div style={{ fontSize: 12, color: C.warning, fontWeight: 700, marginBottom: 8 }}>{selectedPlan.priceLabel}</div>
              <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7, marginBottom: 12 }}>
                {selectedPlan.description}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {selectedPlan.deliverables.map((item) => (
                  <div key={item} style={{ fontSize: 12, color: C.textMuted }}>
                    · {item}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textDim, lineHeight: 1.7 }}>
                플랜 가이드 uplift: +{selectedPlan.targetLift}점 기준 · 납기 {selectedPlan.turnaroundLabel}
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>설치 SOP 미리보기</div>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8, marginBottom: 12 }}>
                {selectedSop.summary}
              </div>
              <div style={{ fontSize: 11, color: C.info, marginBottom: 10 }}>{selectedSop.supportModeLabel} · {selectedSop.kickoff}</div>
              <TemplateList title="설치 단계" items={selectedSop.steps} />
              <div style={{ marginTop: 12 }}>
                <TemplateList title="검증 포인트" items={selectedSop.verification} />
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: C.textDim, lineHeight: 1.7 }}>
                롤백: {selectedSop.rollback}
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>운영 채널</div>
              <div style={{ display: "grid", gap: 8 }}>
                {commercialChannels.map((channel) => (
                  <div key={channel.id} style={{ padding: 12, borderRadius: 12, background: C.surface, border: `1px solid ${(channel.href || channel.fallbackPath) ? C.border : `${C.warning}30`}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{channel.label}</div>
                      <div style={{ fontSize: 10, color: channel.href ? C.success : (channel.fallbackPath ? C.info : C.warning) }}>
                        {channel.href ? "외부 연결" : channel.fallbackPath ? "앱 내 fallback" : "미설정"}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.7 }}>
                      {channel.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Pilot 운영 보드</div>
              <div style={{ display: "grid", gap: 10 }}>
                {previewStageFlow.map((stage) => (
                  <div key={stage.id} style={{ padding: 12, borderRadius: 12, background: C.surface, border: `1px solid ${stage.status === "ready" ? `${C.success}30` : C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{stage.label}</div>
                      <div style={{ fontSize: 10, color: stage.status === "ready" ? C.success : C.textDim }}>{stage.owner}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.7 }}>{stage.description}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <TemplateList
                  title="SLA"
                  items={[
                    `킥오프: ${previewPilotSla.kickoff}`,
                    `자료 검토: ${previewPilotSla.assetReview}`,
                    `1차 초안: ${previewPilotSla.firstDraft}`,
                    `수정 반영: ${previewPilotSla.revision}`,
                    `설치/재진단: ${previewPilotSla.install} / ${previewPilotSla.remeasure}`,
                  ]}
                />
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>첫 파일럿 케이스</div>
                <div style={{ fontSize: 10, color: C.warning }}>{featuredCase.statusLabel}</div>
              </div>
              <div style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>
                {featuredCase.companyName} · {featuredCase.domain}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8, marginBottom: 12 }}>
                {featuredCase.summary}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
                <MetricCard label="Before · Lint" value={`${featuredCase.beforeState.lint.passed}/${featuredCase.beforeState.lint.total}`} tone={C.warning} />
                <MetricCard label="After · Lint" value={`${featuredCase.afterState.lint.passed}/${featuredCase.afterState.lint.total}`} tone={C.info} />
                <MetricCard label="Before · Facts" value={`${featuredCase.beforeState.groundTruth.fieldCount}개`} tone={C.warning} />
                <MetricCard label="After · Facts" value={`${featuredCase.afterState.groundTruth.fieldCount}개`} tone={C.success} />
              </div>
              <div style={{ fontSize: 11, color: C.textDim, marginBottom: 12 }}>
                기준일 {featuredCase.updatedAt} · 설치 경로 {featuredCase.installPath}
              </div>
              <TemplateList title="핵심 개입" items={featuredCase.appliedFixes} />
              <div style={{ marginTop: 12 }}>
                <TemplateList title="관찰된 변화" items={featuredCase.observedChanges} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                <a href={buildPilotCaseHref(featuredCase.id)} style={channelLinkStyle(false)}>케이스 상세 보기</a>
                <a href={`/diagnose?url=${encodeURIComponent(featuredCase.rootUrl)}`} style={channelLinkStyle(false)}>메인 재진단</a>
                <a href={`/diagnose?url=${encodeURIComponent(featuredCase.profileUrl)}`} style={channelLinkStyle(false)}>/ai-profile 재진단</a>
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 16, padding: 20, border: `1px solid ${C.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Before / After 초안</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <MetricCard label="Before" value={previewBeforeScore !== null ? `${previewBeforeScore}점` : "미측정"} tone={C.warning} />
                <MetricCard label="After" value={previewAfterScore !== null ? `${previewAfterScore}점` : "설치 후 측정"} tone={C.success} />
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8, marginBottom: 12 }}>
                메인 사이트를 크게 건드리지 않고 `/ai-profile` 정적 페이지를 추가하는 방식으로 AI가 읽는 공식 정보를 재구성합니다.
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {[
                  "정적 HTML + Schema.org JSON-LD 3종 이상",
                  "한영 FAQ / 핵심 정보 상단 배치",
                  `${selectedTemplate.label} 템플릿 적용`,
                  "설치 후 동일 URL 재진단",
                  "footer 링크 + sitemap + canonical + robots 점검",
                ].map((item) => (
                  <div key={item} style={{ fontSize: 12, color: C.textMuted }}>· {item}</div>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>공개 케이스 미리보기</div>
                <div style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>{previewCaseStudy.title}</div>
                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8 }}>
                  {previewCaseStudy.hook}
                </div>
              </div>
            </div>

            {result && (
              <div style={{ background: `linear-gradient(135deg,${C.successBg},${C.infoBg})`, borderRadius: 16, padding: 20, border: `1px solid ${C.success}25` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: C.textDim }}>Generated Intake Draft</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{result.reportTemplate.title}</div>
                  </div>
                  <div style={{ fontSize: 11, color: C.textDim }}>{result.draftId}</div>
                </div>

                <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8, marginBottom: 12 }}>
                  {result.beforeAfter.summary}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>우선순위</div>
                  {result.priorities.map((item) => (
                    <div key={item} style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>· {item}</div>
                  ))}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>적용 템플릿</div>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8 }}>
                    {result.template.label} · {result.template.summary}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {result.template.schemaTypes.map((schema) => (
                      <span key={schema} style={{ padding: "4px 8px", borderRadius: 999, background: C.surface, border: `1px solid ${C.border}`, fontSize: 10, color: C.textMuted }}>
                        {schema}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>산출물</div>
                  {result.deliverables.map((item) => (
                    <div key={item} style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>· {item}</div>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>설치 체크리스트</div>
                  {result.installation.checklist.map((item) => (
                    <div key={item} style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>· {item}</div>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>설치 SOP</div>
                  <div style={{ fontSize: 12, color: C.info, marginBottom: 6 }}>
                    {result.installation.sop.label} · {result.installation.sop.supportModeLabel}
                  </div>
                  {result.installation.sop.steps.map((item) => (
                    <div key={item} style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>· {item}</div>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>Pilot 체크리스트</div>
                  {result.pilotOps.checklist.map((item) => (
                    <div key={item.id} style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
                      · {item.owner} · {item.label}
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>Pilot SLA</div>
                  {Object.entries(result.pilotOps.sla).map(([key, value]) => (
                    <div key={key} style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
                      · {formatPilotSlaKey(key)}: {value}
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>공개 케이스 초안</div>
                  <div style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>{result.pilotOps.caseStudy.title}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.8, marginBottom: 8 }}>
                    {result.pilotOps.caseStudy.hook}
                  </div>
                  {result.pilotOps.caseStudy.metrics.map((metric) => (
                    <div key={metric.id} style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>
                      · {metric.label}: {metric.value}
                    </div>
                  ))}
                  <div style={{ marginTop: 10 }}>
                    <TemplateList title="공개 승인 체크" items={result.pilotOps.caseStudy.approvalChecklist} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <button onClick={() => copyText("mail", result.mailBody)} style={secondaryButtonStyle()}>
                    {copied === "mail" ? "메일 본문 복사됨" : "메일 본문 복사"}
                  </button>
                  <button onClick={() => copyText("case-study", buildCaseStudyClipboard(result.pilotOps.caseStudy))} style={secondaryButtonStyle()}>
                    {copied === "case-study" ? "케이스 초안 복사됨" : "케이스 초안 복사"}
                  </button>
                  <button onClick={downloadMarkdown} style={secondaryButtonStyle()}>
                    Markdown 다운로드
                  </button>
                  <a href={result.mailtoHref} style={secondaryLinkStyle()}>
                    메일 초안 열기
                  </a>
                </div>

                <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
                  {result.channels.filter((channel) => channel.id !== "email").map((channel) => (
                    channel.configured ? (
                      <a key={channel.id} href={channel.href} target={channel.source === "external" ? "_blank" : undefined} rel={channel.source === "external" ? "noreferrer" : undefined} style={channelLinkStyle(channel.primary)}>
                        {channel.label} {channel.source === "external" ? "열기" : "열기 (앱 내)"}
                      </a>
                    ) : (
                      <div key={channel.id} style={{ ...channelLinkStyle(false), cursor: "default", opacity: 0.6 }}>
                        {channel.label} 미설정
                      </div>
                    )
                  ))}
                </div>

                <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.7 }}>
                  초안은 서버에 저장하지 않고 즉시 생성만 합니다. 실제 접수는 메일 또는 위 운영 채널로 이어집니다.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 12, color: "#b7b7cd", marginBottom: 6 }}>{label}</div>
      {children}
      {error && <div style={{ fontSize: 11, color: "#ff7383", marginTop: 6 }}>{error}</div>}
    </label>
  );
}

function MetricCard({ label, value, tone }) {
  return (
    <div style={{ background: C.surface, borderRadius: 12, padding: 14, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.textDim, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: tone, fontFamily: "'Outfit',sans-serif" }}>{value}</div>
    </div>
  );
}

function TemplateList({ title, items }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {items.map((item) => (
          <div key={item} style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>· {item}</div>
        ))}
      </div>
    </div>
  );
}

function inputStyle(hasError) {
  return {
    width: "100%",
    borderRadius: 10,
    border: `1px solid ${hasError ? "#ff7383" : C.border}`,
    background: C.surface,
    color: C.text,
    padding: "12px 13px",
    boxSizing: "border-box",
    outline: "none",
    fontSize: 13,
  };
}

function textareaStyle(hasError) {
  return {
    ...inputStyle(hasError),
    resize: "vertical",
    minHeight: 88,
    fontFamily: "inherit",
    lineHeight: 1.7,
  };
}

function selectStyle() {
  return {
    ...inputStyle(),
    appearance: "none",
  };
}

function secondaryButtonStyle() {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.textMuted,
    fontSize: 12,
    cursor: "pointer",
  };
}

function secondaryLinkStyle() {
  return {
    ...secondaryButtonStyle(),
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  };
}

function templateCardStyle(active) {
  return {
    textAlign: "left",
    padding: "12px 12px",
    borderRadius: 12,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? `linear-gradient(135deg,${C.g1}15,${C.g2}12)` : C.surface,
    cursor: "pointer",
  };
}

function channelLinkStyle(primary) {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    textDecoration: "none",
    fontSize: 12,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${primary ? "transparent" : C.border}`,
    background: primary ? `linear-gradient(135deg,${C.g1},${C.g2})` : C.surface,
    color: primary ? "#fff" : C.textMuted,
  };
}

function getPreviewPilotStages() {
  return [
    { id: "received", label: "접수 완료", owner: "AAO", description: "문의 접수와 기본 채널 확인", status: "ready" },
    { id: "scoped", label: "범위 확정", owner: "AAO + 고객", description: "플랜, 템플릿, 납기 확정", status: "pending" },
    { id: "draft", label: "초안 전달", owner: "AAO", description: "AI 프로필 1차안 전달", status: "pending" },
    { id: "install", label: "설치 완료", owner: "AAO / 고객", description: "`/ai-profile` 배포 및 검증", status: "pending" },
    { id: "case_study", label: "케이스 승인", owner: "AAO + 고객", description: "공개 가능한 Before/After 승인", status: "pending" },
  ];
}

function getPreviewCaseStudy({ companyName, beforeScore, afterScore, templateLabel, planLabel }) {
  const label = companyName || "고객사";
  return {
    title: `${label} AI Profile Before/After`,
    hook: `${templateLabel} 템플릿과 ${planLabel} 플랜 기준으로 Before/After 케이스 스터디를 만들 수 있습니다.`,
    metrics: [
      { id: "before", label: "Before", value: beforeScore !== null ? `${beforeScore}점` : "미측정" },
      { id: "after", label: "After", value: afterScore !== null ? `${afterScore}점` : "설치 후 측정" },
    ],
  };
}

function formatPilotSlaKey(key) {
  if (key === "kickoff") return "킥오프";
  if (key === "assetReview") return "자료 검토";
  if (key === "firstDraft") return "1차 초안";
  if (key === "revision") return "수정 반영";
  if (key === "install") return "설치";
  if (key === "remeasure") return "재진단";
  return key;
}

function buildCaseStudyClipboard(caseStudy) {
  return [
    caseStudy.title,
    "",
    caseStudy.hook,
    "",
    ...caseStudy.metrics.map((metric) => `- ${metric.label}: ${metric.value}`),
    "",
    "공개 승인 체크",
    ...caseStudy.approvalChecklist.map((item) => `- ${item}`),
  ].join("\n");
}
