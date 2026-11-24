import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import "@/components/slides/slides.css";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "SlideForge — AI 포트폴리오 & 프레젠테이션 빌더",
  description:
    "자연어, 채용공고, 참고 자료로 포트폴리오를 기획하고 편집 가능한 16:9 슬라이드로 만들어 PDF로 출력합니다.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="sf-shell">
          <TopBar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
