import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import App from './App'
import LandingPage from './pages/Landing/LandingPage'
import LoginPage from './pages/LoginPage'
import FocusRailDemo from './pages/FocusRailDemo'
import PageTransition from './components/shared/PageTransition'

export default function AppRouter() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* 默认首页 - Landing Home Page */}
        <Route
          path="/"
          element={
            <PageTransition>
              <LandingPage />
            </PageTransition>
          }
        />
        {/* Workspace 页面 */}
        <Route
          path="/workspace"
          element={
            <PageTransition>
              <App />
            </PageTransition>
          }
        />
        {/* Generate 页面（别名） */}
        <Route
          path="/generate"
          element={
            <PageTransition>
              <App />
            </PageTransition>
          }
        />
        {/* 项目详情页面 */}
        <Route
          path="/project/:id"
          element={
            <PageTransition>
              <App />
            </PageTransition>
          }
        />
        <Route
          path="/login"
          element={
            <PageTransition>
              <LoginPage />
            </PageTransition>
          }
        />
        {/* FocusRail 组件演示页 */}
        <Route
          path="/focus-rail"
          element={
            <PageTransition>
              <FocusRailDemo />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  )
}