import type { Metadata } from "next";
import { fontClassNames } from "@/lib/fonts";
import "./styles/tokens.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://2026eva.vercel.app";

export const metadata: Metadata = {
  title: "학교평가 설문 생성기",
  description: "연구부장이 링크를 나눠 주면 부장들이 학교평가 문항을 담아 제출하고, 설문지(DOCX)와 Google Forms로 내보냅니다.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "학교평가 설문 생성기",
    description: "연구부장이 링크를 나눠 주면 부장들이 학교평가 문항을 담아 제출하고, 설문지(DOCX)와 Google Forms로 내보냅니다.",
    url: "/",
    siteName: "학교평가 설문 생성기",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "학교평가 설문 생성기 문항 구성 화면"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "학교평가 설문 생성기",
    description: "연구부장이 링크를 나눠 주면 부장들이 학교평가 문항을 담아 제출하고, 설문지(DOCX)와 Google Forms로 내보냅니다.",
    images: ["/og-image.png"]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={fontClassNames}>
      <body>{children}</body>
    </html>
  );
}
