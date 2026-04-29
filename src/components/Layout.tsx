import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import Sidebar from './Sidebar'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      <TopBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area — offset by topbar + sidebar */}
      <div
        className="min-h-screen"
        style={{ paddingTop: 'var(--topbar-height)', paddingLeft: '0' }}
      >
        <div className="lg:pl-[256px]">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
