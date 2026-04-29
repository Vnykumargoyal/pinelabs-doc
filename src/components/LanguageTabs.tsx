interface Tab { id: string; label: string }

interface LanguageTabsProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tab: string) => void
  variant?: 'primary' | 'secondary'
}

export default function LanguageTabs({ tabs, activeTab, onTabChange, variant = 'primary' }: LanguageTabsProps) {
  if (variant === 'secondary') {
    // Pill-style tabs for sub-sections (Setup / Quickstart / Examples)
    return (
      <div className="flex items-center gap-1.5 mb-6 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-1.5 text-sm rounded-stripe font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-pine-500 text-white shadow-sm'
                : 'text-stripe-muted bg-stripe-surface hover:bg-stripe-border hover:text-stripe-text border border-stripe-border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    )
  }

  // Underline-style tabs (primary — language switcher)
  return (
    <div className="flex border-b border-stripe-border mb-0 overflow-x-auto gap-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative ${
            activeTab === tab.id
              ? 'text-stripe-text'
              : 'text-stripe-muted hover:text-stripe-text'
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
              style={{ background: '#1A56DB' }}
            />
          )}
        </button>
      ))}
    </div>
  )
}
