import type { Metadata } from "next";
import { fontClassNames } from "@/lib/fonts";
import "./styles/tokens.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://2026eva.vercel.app";

export const metadata: Metadata = {
  title: "학교평가 업무 도우미",
  description: "초등학교 학교평가를 위한 설문 작성, 부장별 공동 작업, 결과 분석과 학교평가서 작성을 돕습니다.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "학교평가 업무 도우미",
    description: "초등학교 학교평가를 위한 설문 작성, 부장별 공동 작업, 결과 분석과 학교평가서 작성을 돕습니다.",
    url: "/",
    siteName: "학교평가 업무 도우미",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-school-evaluation.png",
        width: 1731,
        height: 909,
        alt: "학교평가 업무 도우미 문항 구성 화면"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "학교평가 업무 도우미",
    description: "초등학교 학교평가를 위한 설문 작성, 부장별 공동 작업, 결과 분석과 학교평가서 작성을 돕습니다.",
    images: ["/og-school-evaluation.png"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={fontClassNames}>
      <body>{children}</body>
    </html>
  );
}
