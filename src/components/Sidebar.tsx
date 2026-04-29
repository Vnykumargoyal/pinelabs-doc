import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface NavItem {
  label: string
  path?: string
  badge?: string
}
interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: 'Getting Started',
    items: [
      { label: 'Overview', path: '/docs/overview' },
    ],
  },
  {
    title: 'Concepts',
    items: [
      { label: 'Lifecycle & Threading',    path: '/docs/concepts/lifecycle' },
      { label: 'Transports',               path: '/docs/concepts/transports' },
      { label: 'Capability Matrix',        path: '/docs/concepts/capabilities' },
      { label: 'Event ID & Reconciliation',path: '/docs/concepts/eventid' },
      { label: 'Error Handling',           path: '/docs/concepts/error-handling' },
      { label: 'Result Payload',           path: '/docs/concepts/result-payload' },
      { label: 'Versioning & Support',     path: '/docs/concepts/versioning' },
    ],
  },
  {
    title: 'Per-Language Guides',
    items: [
      { label: 'Android (Kotlin)', path: '/docs/languages/android', badge: 'Shipping' },
      { label: 'iOS (Swift)',      path: '/docs/languages/ios',     badge: 'Preview'  },
      { label: 'Python',          path: '/docs/languages/python',   badge: 'Preview'  },
      { label: 'Node.js (TS)',    path: '/docs/languages/nodejs',   badge: 'Preview'  },
      { label: 'C / C++',        path: '/docs/languages/c',         badge: 'Preview'  },
    ],
  },
  {
    title: 'Wire Formats',
    items: [
      { label: 'CSV Format',         path: '/docs/wire-formats/csv' },
      { label: 'PAD Controller Frame', path: '/docs/wire-formats/pad-controller-frame' },
    ],
  },
]

function SidebarSection({
  section, isOpen, onToggle, onNavClick,
}: {
  section: NavSection
  isOpen: boolean
  onToggle: () => void
  onNavClick: () => void
}) {
  const location = useLocation()

  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 text-2xs font-semibold uppercase tracking-widest text-stripe-subtle hover:text-stripe-muted"
      >
        <span>{section.title}</span>
        {isOpen
          ? <ChevronDown size={11} className="flex-shrink-0" />
          : <ChevronRight size={11} className="flex-shrink-0" />}
      </button>

      {isOpen && (
        <ul className="mt-0.5 space-y-0.5">
          {section.items.map((item) => {
            const isActive = item.path === location.pathname
            return (
              <li key={item.path}>
                <Link
                  to={item.path || '#'}
                  onClick={onNavClick}
                  className={`flex items-center justify-between px-3 py-1.5 text-sm rounded-stripe transition-colors ${
                    isActive
                      ? 'sidebar-active'
                      : 'text-stripe-muted hover:text-stripe-text hover:bg-stripe-surface'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`ml-2 text-2xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${
                      item.badge === 'Shipping'
                        ? 'bg-stripe-green-bg text-stripe-green'
                        : 'bg-stripe-orange-bg text-stripe-orange'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(navSections.map(s => s.title))
  )

  const toggleSection = (title: string) =>
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed left-0 bottom-0 bg-white border-r border-stripe-border overflow-y-auto z-40 transition-transform duration-200 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
        style={{ top: 'var(--topbar-height)', width: 'var(--sidebar-width)' }}
      >
        {/* Sidebar header */}
        <div className="px-4 py-4 border-b border-stripe-border">
          <p className="text-xs font-medium text-stripe-muted">Pine Labs Billing SDK</p>
          <p className="text-2xs text-stripe-subtle mt-0.5">Documentation · v1</p>
        </div>

        <nav className="py-3 px-2">
          {navSections.map((section) => (
            <SidebarSection
              key={section.title}
              section={section}
              isOpen={openSections.has(section.title)}
              onToggle={() => toggleSection(section.title)}
              onNavClick={onClose}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-stripe-border mt-2">
          <a
            href="https://developer.pinelabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-stripe-subtle hover:text-stripe-muted"
          >
            developer.pinelabs.com ↗
          </a>
        </div>
      </aside>
    </>
  )
}
