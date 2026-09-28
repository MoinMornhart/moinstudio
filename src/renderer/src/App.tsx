import { useEffect, useState } from 'react'
import { TABS, type AppInfo, type TabId } from '@shared/app'
import { ThumbnailTab } from './tabs/ThumbnailTab'
import { SchnittTab } from './tabs/SchnittTab'
import { PlanungTab } from './tabs/PlanungTab'
import { EinstellungenTab } from './tabs/EinstellungenTab'
import { UpdateBanner } from './components/UpdateBanner'
import { HardwareBanner } from './components/HardwareCard'
import { JobsWidget } from './components/JobsWidget'
import { SetupWizard } from './components/SetupWizard'

export function App(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>('thumbnail')
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [setupDone, setSetupDone] = useState<boolean | null>(null)

  useEffect(() => {
    void window.moin.appInfo().then(setInfo)
    void window.moin.setupState().then(setSetupDone)
    return window.moin.onSelectTab(setTab)
  }, [])

  return (
    <div className="shell">
      {setupDone === false && <SetupWizard onDone={() => setSetupDone(true)} />}
      <nav className="sidebar" aria-label="Hauptnavigation">
        <div className="brand">
          <div className="brand-logo" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
          <div className="brand-name">
            Moin<span>Studio</span>
          </div>
        </div>
        <ul className="tabs" role="tablist">
          {TABS.map((t) => (
            <li key={t.id}>
              <button
                role="tab"
                aria-selected={tab === t.id}
                className={tab === t.id ? 'tab active' : 'tab'}
                onClick={() => setTab(t.id)}
              >
                <span className="tab-icon" aria-hidden="true">{t.icon}</span>
                {t.label}
              </button>
            </li>
          ))}
        </ul>
        <JobsWidget />
        <div className="sidebar-foot">{info ? `v${info.version}` : ''}</div>
      </nav>
      <main className="content" role="tabpanel">
        <UpdateBanner />
        <HardwareBanner />
        {tab === 'thumbnail' && <ThumbnailTab />}
        {tab === 'schnitt' && <SchnittTab />}
        {tab === 'planung' && <PlanungTab />}
        {tab === 'einstellungen' && <EinstellungenTab info={info} />}
      </main>
    </div>
  )
}
