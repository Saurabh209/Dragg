import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import CanvasBoard from './components/shared/CanvasBoard';
import FreestyleCanvas from './components/freestyle/FreestyleCanvas';
import SystemDesignCanvas from './components/system_design/SystemDesignCanvas';
import DevTool from './components/shared/DevTool';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const checkIsDevMode = () => {
  if (typeof window === 'undefined') return false;
  const isUnlocked = localStorage.getItem('dragg_force_dev_unlocked') === 'true';
  if (isUnlocked) return true;
  const isSimulatedProd = localStorage.getItem('dragg_simulated_prod') === 'true';
  if (isSimulatedProd) return false;
  return import.meta.env.DEV;
};

function BoardDispatcher({ boardId, boardPassword, forceViewOnly, onBack, showToast }) {
  const [boardPreset, setBoardPreset] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (boardId.startsWith('sd_')) {
      setBoardPreset('system_design');
      setIsLoading(false);
      return;
    }
    if (boardId.startsWith('fs_')) {
      setBoardPreset('freestyle');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch(`${API_BASE}/boards/${boardId}`)
      .then((res) => res.json())
      .then((data) => {
        setBoardPreset(data.preset || 'freestyle');
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to resolve board preset', err);
        setBoardPreset('freestyle');
        setIsLoading(false);
      });
  }, [boardId]);

  if (isLoading) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0a0a0c', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f8fafc', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>Loading Board...</span>
        </div>
      </div>
    );
  }

  if (boardPreset === 'system_design') {
    const isDevMode = checkIsDevMode();
    if (!isDevMode) {
      showToast("You don't have access to development feature", 'error');
      onBack();
      return null;
    }
    return <SystemDesignCanvas boardId={boardId} onBack={onBack} showToast={showToast} />;
  }

  return (
    <CanvasBoard 
      boardId={boardId} 
      boardPassword={boardPassword}
      forceViewOnly={forceViewOnly}
      onBack={onBack} 
      showToast={showToast} 
    />
  );
}
import { Maximize2, Minimize2 } from 'lucide-react';

function App() {
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [boardPassword, setBoardPassword] = useState('');
  const [forceViewOnly, setForceViewOnly] = useState(false);
  const [showDevAuthModal, setShowDevAuthModal] = useState(false);
  const [devPasswordInput, setDevPasswordInput] = useState('');
  const [isDevUnlocked, setIsDevUnlocked] = useState(() => localStorage.getItem('dragg_force_dev_unlocked') === 'true');
  const [isDevActive, setIsDevActive] = useState(() => checkIsDevMode());

  useEffect(() => {
    const handleEnvChange = () => {
      setIsDevActive(checkIsDevMode());
    };
    window.addEventListener('dragg-env-change', handleEnvChange);
    return () => window.removeEventListener('dragg-env-change', handleEnvChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        setShowDevAuthModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleDevAuthSubmit = (e) => {
    e.preventDefault();
    if (isDevUnlocked) {
      localStorage.removeItem('dragg_force_dev_unlocked');
      setIsDevUnlocked(false);
      setShowDevAuthModal(false);
      window.dispatchEvent(new Event('dragg-env-change'));
      showToast('Dev Master Mode locked.', 'info');
      return;
    }

    if (devPasswordInput === 'iameldenlord') {
      localStorage.setItem('dragg_force_dev_unlocked', 'true');
      setIsDevUnlocked(true);
      setShowDevAuthModal(false);
      setDevPasswordInput('');
      window.dispatchEvent(new Event('dragg-env-change'));
      showToast('🔥 Dev Master Mode Unlocked! Full System Design access granted.', 'success');
    } else {
      showToast('Incorrect secret passcode!', 'error');
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#\/board\/([a-zA-Z0-9_-]+)$/);
      if (match) {
        setCurrentBoardId(match[1]);
      } else {
        setCurrentBoardId(null);
        setBoardPassword('');
        setForceViewOnly(false);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!(document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.mozFullScreenElement ||
          document.msFullscreenElement)
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  const showToast = (message, type = 'success') => {
    // Toast notifications completely disabled per user request
    return;
  };

  return (
    <>
      {/* Universal Fullscreen Logo Button */}
      {/* <button
        onClick={handleToggleFullscreen}
        style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '1.25rem',
          zIndex: 999999,
          width: '38px',
          height: '38px',
          borderRadius: '8px',
          background: 'rgba(10, 10, 15, 0.75)',
          backdropFilter: 'blur(12px)',
          border: isFullscreen ? '1.5px solid var(--accent-indigo)' : '1.5px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: isFullscreen ? '#a5b4fc' : 'var(--color-text-muted)',
          boxShadow: isFullscreen ? '0 0 16px rgba(99, 102, 241, 0.4)' : '0 4px 12px rgba(0, 0, 0, 0.25)',
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="universal-fullscreen-logo glass"
        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button> */}

      {currentBoardId === null ? (
        <Dashboard 
          onSelectBoard={(boardId, password = '', viewOnly = false) => {
            setBoardPassword(password);
            setForceViewOnly(viewOnly);
            window.location.hash = `#/board/${boardId}`;
          }} 
          showToast={showToast} 
        />
      ) : (
        <BoardDispatcher 
          boardId={currentBoardId} 
          boardPassword={boardPassword}
          forceViewOnly={forceViewOnly}
          onBack={() => {
            window.location.hash = '';
          }} 
          showToast={showToast} 
        />
      )}

      {/* Secret Dev Mode Unlock Modal (Ctrl + Shift + D) */}
      {showDevAuthModal && (
        <div 
          className="modal-overlay"
          onClick={() => setShowDevAuthModal(false)}
          style={{ zIndex: 999999 }}
        >
          <div 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '420px',
              maxWidth: '90%',
              background: 'rgba(14, 14, 22, 0.96)',
              backdropFilter: 'blur(16px)',
              border: isDevUnlocked ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '16px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{isDevUnlocked ? '🔓' : '🔑'}</span>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>
                  {isDevUnlocked ? 'Dev Master Mode Unlocked' : 'Enter Dev Passcode'}
                </h3>
              </div>
              <button 
                onClick={() => setShowDevAuthModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDevAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {!isDevUnlocked ? (
                <div>
                  <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                    Enter secret passcode to force unlock Development Mode & System Design features in Production environment.
                  </p>
                  <input
                    type="password"
                    autoFocus
                    placeholder="Enter secret passcode..."
                    value={devPasswordInput}
                    onChange={(e) => setDevPasswordInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#fef08a' }}>
                  Dev Master Mode is currently active! You have full access to all developer features and System Design whiteboards.
                </p>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDevAuthModal(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.4rem 1rem',
                    background: isDevUnlocked ? 'rgba(239, 68, 68, 0.8)' : 'var(--accent-indigo)'
                  }}
                >
                  {isDevUnlocked ? 'Relock Dev Mode' : 'Unlock Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification Layer */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type} glass`}>
            {toast.type === 'success' ? '✓' : '✗'} {toast.message}
          </div>
        ))}
      </div>

      {/* Embedded DevTool (Dev Mode or Forced Unlocked) */}
      {isDevActive && <DevTool />}
    </>
  );
}

export default App;
