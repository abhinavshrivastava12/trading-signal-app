import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import CreateSignalForm from './components/CreateSignalForm';
import './styles.css';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSignalCreated = () => {
    setActiveTab('dashboard');
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">📈</span>
            <span className="logo-text">SignalTracker</span>
          </div>
          <nav className="nav">
            <button
              className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              Dashboard
            </button>
            <button
              className={`nav-btn ${activeTab === 'create' ? 'active' : ''}`}
              onClick={() => setActiveTab('create')}
            >
              + New Signal
            </button>
          </nav>
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'dashboard' && <Dashboard key={refreshKey} />}
        {activeTab === 'create' && <CreateSignalForm onSuccess={handleSignalCreated} />}
      </main>
    </div>
  );
}

export default App;
