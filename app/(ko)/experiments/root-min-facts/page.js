import RootExperimentPage from "@/components/RootExperimentPage";
import {
  CONTACT_EMAIL,
  ENTITY_LABEL,
  ENTITY_TYPE_LABEL,
  FOUNDER_NAME_KO,
  FOUNDER_NAME_EN,
  FOUNDING_YEAR,
  HEADQUARTERS_REGION,
  OFFICIAL_FACT_DESCRIPTION,
  PRIMARY_SERVICES_LABEL,
} from "@/lib/site-identity";

export const metadata = {
  title: "AAO Root Experiment B | Minimal Facts",
  description: "Internal experiment: root page with minimal visible facts and canonical link signal.",
};

export default function RootMinFactsPage() {
  return (
    <RootExperimentPage
      label="AAO · 구조 검증(린트) + AI 전달 확인"
      intro="AAO (AI Answer Optimization)는 공식 웹사이트와 /ai-profile 페이지를 AI의 1차 출처로 만들기 위해, 메인 페이지 구조와 실제 AI 전달 결과를 함께 진단하는 서비스입니다."
      factLines={[
        `${ENTITY_LABEL}는 ${OFFICIAL_FACT_DESCRIPTION}입니다. 업종: ${ENTITY_TYPE_LABEL}. 설립연도: ${FOUNDING_YEAR}.`,
        `본사: ${HEADQUARTERS_REGION}. 대표이사: ${FOUNDER_NAME_KO} (${FOUNDER_NAME_EN}). 주요 서비스: ${PRIMARY_SERVICES_LABEL}.`,
        `공식 문의: ${CONTACT_EMAIL}.`,
      ]}
    />
  );
}
