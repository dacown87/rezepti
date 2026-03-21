import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import RecipeList from './components/RecipeList'
import ExtractionPage from './components/ExtractionPage'
import SettingsPage from './components/SettingsPage'
import RecipeDetail from './components/RecipeDetail'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<RecipeList />} />
        <Route path="/extract" element={<ExtractionPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
      </Routes>
    </Layout>
  )
}

export default App