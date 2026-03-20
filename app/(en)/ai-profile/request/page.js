import AiProfileRequestPage from "@/components/AiProfileRequestPage";

export const metadata = {
  title: "AI 프로필 페이지 제작 요청 | AAO",
  description:
    "AAO 진단 결과를 바탕으로 AI 프로필 페이지 제작 요청을 접수하고 Before/After 초안을 생성합니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AiProfileRequestRoute({ searchParams }) {
  return <AiProfileRequestPage initialQuery={searchParams} />;
}
