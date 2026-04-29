import { Search, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";

export default function TopBar({ onMenuToggle }: { onMenuToggle: () => void }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 px-4 bg-white border-b border-stripe-border"
      style={{ height: "var(--topbar-height)" }}
    >
      {/* Mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden text-stripe-muted hover:text-stripe-text p-1 rounded"
        aria-label="Toggle menu"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Logo */}
      <Link
        to="/docs/overview"
        className="flex items-center gap-2.5 flex-shrink-0 mr-2"
      >
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, #f97316 0%, #1A56DB 100%)",
          }}
        >
          PL
        </div>
        <span className="font-semibold text-stripe-text text-[15px]">
          Pine Labs
        </span>
        <span className="text-stripe-border text-lg select-none">|</span>
        <span className="text-stripe-muted text-sm">Developers</span>
      </Link>

      {/* Nav links — desktop */}
      <nav className="hidden lg:flex items-center gap-1">
        {[
          { label: "Overview", to: "/docs/overview" },
          { label: "Guides", to: "/docs/concepts/lifecycle" },
          { label: "Languages", to: "/docs/languages/android" },
        ].map(({ label, to }) => (
          <Link
            key={to}
            to={to}
            className="px-3 py-1.5 text-sm text-stripe-muted hover:text-stripe-text rounded hover:bg-stripe-surface transition-colors"
          >
            {label}
          </Link>
        ))}
      </nav>

      {/* Search */}
      {/* <div className="flex-1 hidden sm:flex justify-center">
        <button className="flex items-center gap-2 w-full max-w-xs px-3 py-1.5 text-sm text-stripe-muted bg-stripe-surface border border-stripe-border rounded-stripe hover:border-stripe-border2 transition-colors">
          <Search size={13} className="flex-shrink-0" />
          <span className="flex-1 text-left">Search docs…</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-2xs font-mono bg-white border border-stripe-border rounded text-stripe-subtle">
            ⌘K
          </kbd>
        </button>
      </div> */}

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2">
        <a
          href="https://github.com/PineLabs-CorePlatform/AppStore_AppMarketplacePortal"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-stripe-muted hover:text-stripe-text hover:bg-stripe-surface rounded transition-colors"
        >
          <GitBranch size={15} />
          <span>GitHub</span>
        </a>
        <span className="text-2xs px-2 py-1 rounded-full font-semibold text-white bg-pine-500">
          v1
        </span>
      </div>
    </header>
  );
}
