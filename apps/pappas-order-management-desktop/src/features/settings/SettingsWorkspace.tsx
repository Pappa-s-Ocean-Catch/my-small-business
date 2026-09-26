import { useState, useEffect } from 'react';

export type LiveOrderCardLayout = 'horizontal' | 'vertical';
export type LiveOrderCardsPerScreen = 3 | 4;

export type AppSettings = {
  liveOrderCardLayout: LiveOrderCardLayout;
  liveOrderCardsPerScreen: LiveOrderCardsPerScreen;
};

const DEFAULT_SETTINGS: AppSettings = {
  liveOrderCardLayout: 'horizontal',
  liveOrderCardsPerScreen: 4,
};

export function getAppSettings(): AppSettings {
  const saved = localStorage.getItem('desktop_app_settings');
  if (saved) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveAppSettings(settings: AppSettings) {
  localStorage.setItem('desktop_app_settings', JSON.stringify(settings));
}

export function SettingsWorkspace() {
  const [settings, setSettings] = useState<AppSettings>(getAppSettings());

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveAppSettings(newSettings);
  };

  return (
    <main className="pos-shell">
      <header className="pos-header">
        <div><p className="eyebrow">PAPPAS POS</p><h1>Settings</h1></div>
      </header>
      <section className="menu-pane" style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800 }}>Live order cards</h2>
          <p style={{ margin: '0 0 20px 0', color: '#6b7280', fontSize: '14px' }}>
            Choose how live orders are displayed on the home screen.
          </p>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Card Layout</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className={`category-button ${settings.liveOrderCardLayout === 'horizontal' ? 'selected' : ''}`}
                style={{ flex: 1, minHeight: '48px', padding: '0 16px' }}
                onClick={() => updateSetting('liveOrderCardLayout', 'horizontal')}
              >
                Horizontal List
              </button>
              <button 
                className={`category-button ${settings.liveOrderCardLayout === 'vertical' ? 'selected' : ''}`}
                style={{ flex: 1, minHeight: '48px', padding: '0 16px' }}
                onClick={() => updateSetting('liveOrderCardLayout', 'vertical')}
              >
                Vertical Cards
              </button>
            </div>
          </div>

          {settings.liveOrderCardLayout === 'vertical' && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Cards per screen (Width)</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  className={`category-button ${settings.liveOrderCardsPerScreen === 3 ? 'selected' : ''}`}
                  style={{ flex: 1, minHeight: '48px', padding: '0 16px' }}
                  onClick={() => updateSetting('liveOrderCardsPerScreen', 3)}
                >
                  3 Cards (Wider)
                </button>
                <button 
                  className={`category-button ${settings.liveOrderCardsPerScreen === 4 ? 'selected' : ''}`}
                  style={{ flex: 1, minHeight: '48px', padding: '0 16px' }}
                  onClick={() => updateSetting('liveOrderCardsPerScreen', 4)}
                >
                  4 Cards (Compact)
                </button>
              </div>
            </div>
          )}
        </div>

      </section>
    </main>
  );
}
