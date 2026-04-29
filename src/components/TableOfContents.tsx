import { useEffect, useState } from 'react'

interface TocItem { id: string; text: string; level: number }

function extractHeadings(markdown: string): TocItem[] {
  const items: TocItem[] = []
  for (const line of markdown.split('\n')) {
    const m2 = line.match(/^## (.+)/)
    const m3 = line.match(/^### (.+)/)
    if (m2) {
      const text = m2[1].replace(/[*_`]/g, '')
      items.push({ id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), text, level: 2 })
    } else if (m3) {
      const text = m3[1].replace(/[*_`]/g, '')
      items.push({ id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), text, level: 3 })
    }
  }
  return items
}

export default function TableOfContents({ markdown }: { markdown: string }) {
  const [activeId, setActiveId] = useState('')
  const items = extractHeadings(markdown)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-72px 0px -60% 0px', threshold: 0 }
    )
    items.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [markdown])

  if (items.length === 0) return null

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const topbarHeight = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--topbar-height') || '56'
      )
      const y = el.getBoundingClientRect().top + window.scrollY - topbarHeight - 16
      window.scrollTo({ top: y, behavior: 'smooth' })
      setActiveId(id)
    }
  }

  return (
    <aside className="hidden xl:block flex-shrink-0" style={{ width: 'var(--toc-width)' }}>
      <div
        className="sticky flex flex-col"
        style={{
          top: 'calc(var(--topbar-height) + 8px)',
          maxHeight: 'calc(100vh - var(--topbar-height) - 16px)',
        }}
      >
        <p className="text-2xs font-semibold uppercase tracking-widest text-stripe-subtle mb-3 px-1 pt-6 flex-shrink-0">
          On this page
        </p>
        <ul className="space-y-0.5 overflow-y-auto pb-6 pr-1" style={{ scrollbarWidth: 'thin' }}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => scrollTo(item.id)}
                className={`w-full text-left block text-[0.8125rem] py-1 px-1 rounded transition-colors leading-snug ${
                  item.level === 3 ? 'pl-4' : ''
                } ${
                  activeId === item.id
                    ? 'text-pine-500 font-medium'
                    : 'text-stripe-subtle hover:text-stripe-muted'
                }`}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
