import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import RecipeList from './components/RecipeList'
import ExtractionPage from './components/ExtractionPage'
import SettingsPage from './components/SettingsPage'
import RecipeDetail from './components/RecipeDetail'
import CookMode from './components/CookMode'
import ShoppingPage from './components/ShoppingPage'
import PlannerPage from './components/PlannerPage'
import ScannerPage from './components/ScannerPage'

function App() {
  return (
    <Routes>
      {/* Fullscreen cook mode — no layout wrapper */}
      <Route path="/recipe/:id/cook" element={<CookMode />} />

      {/* All other routes use the standard layout */}
      <Route path="*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<RecipeList />} />
            <Route path="/extract" element={<ExtractionPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/shopping" element={<ShoppingPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/scan" element={<ScannerPage />} />
            <Route path="/recipe/:id" element={<RecipeDetail />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  )
}

export default App