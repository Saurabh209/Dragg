import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import CanvasBoard from './components/CanvasBoard';
import { Maximize2, Minimize2 } from 'lucide-react';

function App() {
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [boardPassword, setBoardPassword] = useState('');
  const [forceViewOnly, setForceViewOnly] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <>
      {/* Universal Fullscreen Logo Button */}
      <button
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
      </button>

      {currentBoardId === null ? (
        <Dashboard 
          onSelectBoard={(boardId, password = '', viewOnly = false) => {
            setCurrentBoardId(boardId);
            setBoardPassword(password);
            setForceViewOnly(viewOnly);
          }} 
          showToast={showToast} 
        />
      ) : (
        <CanvasBoard 
          boardId={currentBoardId} 
          boardPassword={boardPassword}
          onUpdatePassword={setBoardPassword}
          forceViewOnly={forceViewOnly}
          onBack={() => {
            setCurrentBoardId(null);
            setBoardPassword('');
            setForceViewOnly(false);
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
    </>
  );
}

export default App;
