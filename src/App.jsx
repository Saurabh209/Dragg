import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import CanvasBoard from './components/CanvasBoard';

function App() {
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [boardPassword, setBoardPassword] = useState('');
  const [forceViewOnly, setForceViewOnly] = useState(false);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <>
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
