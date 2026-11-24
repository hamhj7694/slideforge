import Link from "next/link";

export function TopBar() {
  return (
    <header className="sf-topbar">
      <div className="flex items-center gap-8">
        <Link href="/" className="sf-brand" aria-label="SlideForge 홈">
          <span className="sf-brand-mark">SF</span>
          <span>SlideForge</span>
        </Link>
        <nav className="sf-nav hidden md:flex">
          <Link href="/">새 만들기</Link>
          <Link href="/projects">프로젝트</Link>
          <Link href="/settings">모델 · 설정</Link>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden text-[11px] text-muted lg:inline">
          편집 가능한 슬라이드를 PDF로 내보냅니다
        </span>
        <Link href="/settings" className="sf-chip hover:border-ink/30">
          생성 설정
        </Link>
      </div>
    </header>
  );
}
