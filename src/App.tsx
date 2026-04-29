import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import OverviewPage from './pages/OverviewPage'
import ConceptPage from './pages/ConceptPage'
import LanguagePage from './pages/LanguagePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/docs/overview" replace />} />
      <Route path="/docs" element={<Layout />}>
        <Route path="overview" element={<OverviewPage />} />
        <Route path="concepts/:slug" element={<ConceptPage />} />
        <Route path="languages/:lang" element={<LanguagePage />} />
        <Route path="languages/:lang/:section" element={<LanguagePage />} />
        <Route path="wire-formats/:slug" element={<ConceptPage />} />
      </Route>
    </Routes>
  )
}
