import type { Metadata } from "next";
import { fontClassNames } from "@/lib/fonts";
import "./styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "학교평가 설문 생성기",
  description: "학교평가 문항 선택, DOCX 출력, Google Forms 생성을 지원하는 웹앱"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={fontClassNames}>
      <body>{children}</body>
    </html>
  );
}
