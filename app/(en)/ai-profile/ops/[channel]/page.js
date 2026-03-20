import AiProfileOpsPage from "@/components/AiProfileOpsPage";
import { getOperationPageContent } from "@/lib/intake";

export function generateMetadata({ params }) {
  const content = getOperationPageContent(params.channel);
  return {
    title: content ? `${content.title} | AAO` : "AAO Ops",
    description: content?.description || "AAO 운영 채널 안내 페이지",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function AiProfileOpsRoute({ params, searchParams }) {
  return <AiProfileOpsPage channelId={params.channel} searchParams={searchParams} />;
}
