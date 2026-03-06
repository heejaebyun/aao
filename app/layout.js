// app/layout.js
export const metadata = {
  title: "AAO — AI Answer Optimization",
  description:
    "AI가 당신의 회사를 정확히 설명할 수 있는지 진단하고 최적화하는 서비스. Princeton GEO Research 기반 3축 진단: PACP · SEP · SPF",
  openGraph: {
    title: "AAO — AI가 당신의 회사를 정확히 알고 있을까요?",
    description:
      "ChatGPT · Gemini · Perplexity가 귀사를 어떻게 소개하는지 30초 안에 무료로 확인하세요. Princeton GEO 연구 기반 AI 가시성 진단.",
    type: "website",
    url: "https://aao.kr",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "AAO — AI Answer Optimization" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AAO — AI가 당신의 회사를 정확히 알고 있을까요?",
    description: "ChatGPT · Gemini · Perplexity가 귀사를 어떻게 소개하는지 무료로 진단하세요.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "AAO - AI Answer Optimization",
              applicationCategory: "BusinessApplication",
              description:
                "AI 검색 엔진이 기업 웹사이트를 얼마나 정확하게 이해하는지 진단하고 최적화하는 B2B SaaS 서비스",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "KRW",
                description: "무료 진단 3회/월",
              },
              creator: {
                "@type": "Organization",
                name: "AAO",
                description:
                  "AI Answer Optimization - AI가 당신의 회사를 정확히 소개할 수 있도록 최적화하는 서비스",
              },
            }),
          }}
        />
      </head>
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
