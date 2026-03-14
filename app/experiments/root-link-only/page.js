import RootExperimentPage from "@/components/RootExperimentPage";

export const metadata = {
  title: "AAO Root Experiment A | Link Only",
  description: "Internal experiment: root page with canonical link signal only.",
};

export default function RootLinkOnlyPage() {
  return (
    <RootExperimentPage
      label="AAO · 구조 검증(린트) + AI 전달 확인"
      intro="AAO (AI Answer Optimization)는 공식 웹사이트와 /ai-profile 페이지를 AI의 1차 출처로 만들기 위해, 메인 페이지 구조와 실제 AI 전달 결과를 함께 진단하는 서비스입니다."
      factLines={[]}
    />
  );
}
