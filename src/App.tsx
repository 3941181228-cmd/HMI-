import { useState, useCallback, useEffect } from 'react'
import { useParams, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import TopNavigation from './components/TopNavigation'
import Sidebar from './components/Sidebar'
import Workspace from './components/Workspace'
import SettingsCenter from './components/SettingsCenter'
import WorkspaceSettingsModal, { type WorkspaceSettings } from './components/WorkspaceSettingsModal'
import { useHistory } from './hooks/useHistory'
import { useTheme } from './hooks/useTheme'

type TabId = 'dashboard' | 'preview' | 'generate' | 'edit' | 'theme' | 'check' | 'export' | 'wallpaper' | 'ai-wallpaper'

function App() {
  const { id: projectId } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { activeThemeId, applyTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<TabId>('generate')
  const [activeSection, setActiveSection] = useState<string>('')
  const [editSubMode, setEditSubMode] = useState<'png2edit' | 'text_extract'>('png2edit')
  const [themePreset, setThemePreset] = useState<string | null>(null)
  const [wallpaperSub, setWallpaperSub] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState('api')
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false)
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>({
    exportPath: '~/Desktop/HMI-Exports',
    defaultModel: 'seedream-5',
    defaultQuality: 'standard',
    autoSave: true,
    autoSaveInterval: 30,
    realTimeSync: true,
  })
  const { records, addRecord, clearHistory, deleteRecords } = useHistory()

  // 刷新重定向逻辑：刷新 /workspace 或 /generate 时重定向到首页
  useEffect(() => {
    const path = location.pathname
    
    // 页面卸载时清除标记（刷新或关闭标签页时触发）
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('hmi-studio-from-home')
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('unload', handleBeforeUnload)
    
    if (path === '/workspace' || path === '/generate') {
      // 检查 URL 参数是否来自首页
      const fromHomeParam = searchParams.get('from') === 'home'
      
      if (fromHomeParam) {
        // 首次从首页点击进入，设置标记并清除 URL 参数
        sessionStorage.setItem('hmi-studio-from-home', 'true')
        navigate('/workspace', { replace: true })
        setActiveTab('generate')
        setActiveSection('ai-gen')
      } else {
        // 检查 sessionStorage 标记
        const sessionMark = sessionStorage.getItem('hmi-studio-from-home')
        
        if (sessionMark === 'true') {
          // 标记存在，正常显示
          setActiveTab('generate')
          setActiveSection('ai-gen')
        } else {
          // 没有标记，说明是刷新或直接访问，重定向回首页
          navigate('/')
          return
        }
      }
    } else if (path.startsWith('/project/')) {
      // 项目页面保持不变
      setActiveTab('preview')
      setActiveSection('preview')
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('unload', handleBeforeUnload)
    }
  }, [location.pathname, navigate, searchParams])

  const handleNavigate = useCallback((target: string) => {
    if (target.includes(':')) {
      const [tab, sub] = target.split(':')
      if (tab === 'check') {
        setActiveTab('check')
        setActiveSection(sub || 'full')
      } else if (tab === 'edit') {
        setActiveTab('edit')
        setEditSubMode(sub as 'png2edit' | 'text_extract')
        setActiveSection('hmi-edit')
      } else if (tab === 'theme') {
        setActiveTab('theme')
        setThemePreset(sub || 'ai-recolor')
        setActiveSection('theme')
      } else if (tab === 'wallpaper') {
        setActiveTab('wallpaper')
        setWallpaperSub(sub || 'anime')
        setActiveSection(sub || 'wallpaper')
      } else if (tab === 'export') {
        setActiveTab('export')
        setActiveSection('export')
      } else if (tab === 'settings') {
        setSettingsTab(sub || 'api')
        setSettingsOpen(true)
      } else if (tab === 'generate') {
        setActiveTab('generate')
        setActiveSection('ai-gen')
      } else if (tab === 'ai-wallpaper') {
        setActiveTab('ai-wallpaper')
        setActiveSection('ai-gen')
      } else {
        setActiveTab(tab as TabId)
        setActiveSection('ai-gen')
      }
    } else {
      if (target === 'dashboard') {
        setActiveTab('dashboard')
        setActiveSection('history')
      } else if (target === 'generate') {
        setActiveTab('generate')
        setActiveSection('ai-gen')
      } else if (target === 'edit') {
        setActiveTab('edit')
        setActiveSection('hmi-edit')
      } else if (target === 'wallpaper') {
        setActiveTab('wallpaper')
        setActiveSection('wallpaper')
      } else if (target === 'ai-wallpaper') {
        setActiveTab('ai-wallpaper')
        setActiveSection('ai-gen')
      } else if (target === 'check') {
        setActiveTab('check')
        setActiveSection('check')
      } else if (target === 'export') {
        setActiveTab('export')
        setActiveSection('export')
      } else if (target === 'theme') {
        setActiveTab('theme')
        setActiveSection('theme')
      } else {
        setActiveTab(target as TabId)
        setActiveSection('ai-gen')
      }
    }
  }, [])

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
    if (tab === 'dashboard') {
      setActiveSection('history')
    } else if (tab === 'generate' || tab === 'ai-wallpaper') {
      setActiveSection('ai-gen')
    } else if (tab === 'edit') {
      setActiveSection('hmi-edit')
    } else if (tab === 'wallpaper') {
      setActiveSection('wallpaper')
    } else if (tab === 'check') {
      setActiveSection('check')
    } else if (tab === 'export') {
      setActiveSection('export')
    } else if (tab === 'theme') {
      setActiveSection('theme')
    }
  }, [])

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <TopNavigation
        autoSave={workspaceSettings.autoSave}
        realTimeSync={workspaceSettings.realTimeSync}
        onOpenWorkspaceSettings={() => setWorkspaceSettingsOpen(true)}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          onNavigate={handleNavigate}
          activeSection={activeSection}
          historyRecords={records}
          onClearHistory={clearHistory}
        />
        <Workspace
          activeTab={activeTab}
          activeSection={activeSection}
          onTabChange={handleTabChange}
          onAddHistory={addRecord}
          onDeleteRecords={deleteRecords}
          editSubModeProp={editSubMode}
          themePresetProp={themePreset}
          wallpaperSubProp={wallpaperSub}
          onNavigate={handleNavigate}
          historyRecords={records}
        />
      </div>
      <SettingsCenter open={settingsOpen} onClose={() => setSettingsOpen(false)} activeTab={settingsTab} activeThemeId={activeThemeId} applyTheme={applyTheme} />
      <WorkspaceSettingsModal
        open={workspaceSettingsOpen}
        onClose={() => setWorkspaceSettingsOpen(false)}
        settings={workspaceSettings}
        onSettingsChange={setWorkspaceSettings}
      />
    </div>
  )
}

export default App
