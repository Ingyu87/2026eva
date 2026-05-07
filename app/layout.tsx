import type { Metadata } from "next";
import { fontClassNames } from "@/lib/fonts";
import "./styles/tokens.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://2026eva.vercel.app";

export const metadata: Metadata = {
  title: "학교평가 설문 생성기",
  description: "학교평가 문항 선택, DOCX 출력, Google Forms 생성을 지원하는 웹앱",
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: "학교평가 설문 생성기",
    description: "학교평가 문항 선택, DOCX 출력, Google Forms 생성을 지원하는 웹앱",
    url: "/",
    siteName: "학교평가 설문 생성기",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 726,
        height: 443,
        alt: "학교평가 설문 생성기 로그인 화면"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "학교평가 설문 생성기",
    description: "학교평가 문항 선택, DOCX 출력, Google Forms 생성을 지원하는 웹앱",
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
