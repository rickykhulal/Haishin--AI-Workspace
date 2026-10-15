/**
 * Haishin brand mark — the logo/wordmark used in the sidebar header.
 */
export function BrandMark({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* Logo icon — a stylized "H" glyph */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#8AB4F8] to-[#5B8DEF] shadow-lg shadow-[#8AB4F8]/10">
        <span className="text-sm font-bold text-[#0B0D12]">H</span>
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-base font-semibold tracking-tight text-[#F3F5F9]">
            Haishin
          </span>
          <span className="text-[10px] uppercase tracking-widest text-[#9AA6B8]">
            by Haitian
          </span>
        </div>
      )}
    </div>
  );
}
