import { Link } from 'react-router-dom'
import MarkdownRenderer from '../components/MarkdownRenderer'
import TableOfContents from '../components/TableOfContents'
import { overviewContent } from '../content/overview'

const platforms = [
  { name: 'Android (Kotlin)', status: 'Shipping', path: '/docs/languages/android', icon: '🤖' },
  { name: 'iOS (Swift)',      status: 'Preview',  path: '/docs/languages/ios',     icon: '🍎' },
  { name: 'Python',           status: 'Preview',  path: '/docs/languages/python',  icon: '🐍' },
  { name: 'Node.js (TS)',     status: 'Preview',  path: '/docs/languages/nodejs',  icon: '⬡'  },
  { name: 'C / C++',         status: 'Preview',  path: '/docs/languages/c',       icon: '⚙️' },
]

const quickLinks = [
  { title: 'Android Quickstart',      desc: 'App-to-App transport, AAR setup',    path: '/docs/languages/android', color: '#eef3ff' },
  { title: 'Lifecycle & Threading',   desc: 'SDK construction, callbacks',         path: '/docs/concepts/lifecycle', color: '#eef3ff' },
  { title: 'Transports',              desc: 'App-to-App, Cloud, PADController',   path: '/docs/concepts/transports', color: '#eef3ff' },
  { title: 'Error Handling',          desc: 'SdkError taxonomy, retry strategy',  path: '/docs/concepts/error-handling', color: '#eef3ff' },
]

export default function OverviewPage() {
  return (
    <div className="flex max-w-6xl mx-auto px-0">
      {/* Main content */}
      <main className="flex-1 min-w-0 px-8 lg:px-10 py-10">

        {/* Hero */}
        <div className="mb-10 pb-10 border-b border-stripe-border">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold mb-4"
            style={{ background: '#eef3ff', color: '#1A56DB' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-pine-500 inline-block" />
            Pine Labs Billing SDK — v1
          </div>
          <h1 className="text-[2.125rem] font-bold text-stripe-text mb-3 leading-tight tracking-tight">
            Pine Labs Billing SDK
          </h1>
          <p className="text-lg text-stripe-muted leading-relaxed max-w-2xl mb-6">
            A single, language-idiomatic library for driving Pine Labs payment terminals
            from your POS, restaurant, retail, or unattended-checkout software.
            Built in Rust, wrapped with UniFFI for every supported platform.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              to="/docs/languages/android"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-stripe text-sm font-medium text-white transition-colors"
              style={{ background: '#1A56DB' }}
            >
              Get started
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <Link
              to="/docs/concepts/lifecycle"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-stripe text-sm font-medium text-stripe-muted border border-stripe-border hover:border-stripe-border2 hover:text-stripe-text transition-colors"
            >
              Read the concepts
            </Link>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {/* Platforms card */}
          <div className="rounded-stripe border border-stripe-border overflow-hidden">
            <div className="px-5 py-4 border-b border-stripe-border bg-stripe-surface">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-stripe-muted">
                Supported Platforms
              </h2>
            </div>
            <ul className="divide-y divide-stripe-border">
              {platforms.map(p => (
                <li key={p.name}>
                  <Link
                    to={p.path}
                    className="flex items-center justify-between px-5 py-3 hover:bg-stripe-surface transition-colors group"
                  >
                    <span className="flex items-center gap-2.5 text-sm text-stripe-muted group-hover:text-stripe-text">
                      <span>{p.icon}</span>
                      {p.name}
                    </span>
                    <span className={`text-2xs px-2 py-0.5 rounded font-semibold ${
                      p.status === 'Shipping'
                        ? 'bg-stripe-green-bg text-stripe-green'
                        : 'bg-stripe-orange-bg text-stripe-orange'
                    }`}>
                      {p.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick links card */}
          <div className="rounded-stripe border border-stripe-border overflow-hidden">
            <div className="px-5 py-4 border-b border-stripe-border bg-stripe-surface">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-stripe-muted">
                Where to Start
              </h2>
            </div>
            <ul className="divide-y divide-stripe-border">
              {quickLinks.map(link => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-stripe-surface transition-colors group"
                  >
                    <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: link.color }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth="2.5">
                        <path d="M9 18l6-6-6-6"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stripe-text group-hover:text-pine-500 leading-snug">
                        {link.title}
                      </p>
                      <p className="text-xs text-stripe-subtle mt-0.5">{link.desc}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Overview markdown */}
        <MarkdownRenderer content={overviewContent} />
      </main>

      {/* TOC */}
      <div className="hidden xl:block px-6 py-10 flex-shrink-0" style={{ width: 'calc(var(--toc-width) + 24px)' }}>
        <TableOfContents markdown={overviewContent} />
      </div>
    </div>
  )
}
