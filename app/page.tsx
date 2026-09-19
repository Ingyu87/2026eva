import type { Metadata } from "next";
import { SchoolEvaluationApp } from "@/components/SchoolEvaluationApp";

/**
 * 부장 링크(/?invite=…)를 카카오톡 등에 붙이면 받는 사람이 "무슨 링크인지" 알 수 있게
 * 링크 전용 미리보기를 씁니다. 토큰은 미리보기에 싣지 않고, 검색에도 잡히지 않게 합니다.
 */
export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}): Promise<Metadata> {
  const { invite } = await searchParams;
  if (!invite) {
    return {};
  }
  const title = "문항 작업 링크가 도착했습니다 · 학교평가 설문 생성기";
  const description = "연구부장이 보낸 링크입니다. 열면 로그인 없이 문항을 골라 담고, 다 하면 제출을 누르세요.";
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      images: [{ url: "/og-invite.png", width: 1200, height: 630, alt: "문항 작업 링크 안내" }]
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og-invite.png"] }
  };
}

export default function Page() {
  return <SchoolEvaluationApp />;
}
