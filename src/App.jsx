import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import CanvasBoard from './components/shared/CanvasBoard';
import FreestyleCanvas from './components/freestyle/FreestyleCanvas';
import SystemDesignCanvas from './components/system_design/SystemDesignCanvas';
import DevTool from './components/shared/DevTool';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
    fetch(`${API_BASE}/system-design-boards/${boardId}`)
      .then((res) => {
        if (!res.ok) return fetch(`${API_BASE}/boards/${boardId}`);
        return res;
      })
      .then((res) => res.json())
      .then((data) => {
        if (data.preset === 'system_design') {
          setBoardPreset('system_design');
        } else {
          setBoardPreset(data.preset || 'freestyle');
        }
        setIsLoading(false);
      })
      .catch(() => {
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
    if (!import.meta.env.DEV) {
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
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    const id = Date.now();
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.message !== message);
      const updated = [...filtered, { id, message, type }];
      if (updated.length > 3) {
        return updated.slice(updated.length - 3);
      }
      return updated;
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
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

      {/* Toast Notification Layer */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type} glass`}>
            {toast.type === 'success' ? '✓' : '✗'} {toast.message}
          </div>
        ))}
      </div>

      {/* Embedded DevTool (Dev Mode Only) */}
      {import.meta.env.DEV && <DevTool />}
    </>
  );
}

export default App;
