import React, { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { checkIsDevMode } from '../../App';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function SystemDesignCanvas({ boardId, onBack, showToast }) {
  const [board, setBoard] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/board/${boardId}`)
      .then((res) => res.json())
      .then((data) => setBoard(data))
      .catch((err) => console.error('Failed to load system design canvas', err));
  }, [boardId]);

  return (
    <div
      data-canvas-root="true"
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#0d1117'
      }}
    >
      {/* Top Header Navbar with Back to Dashboard button */}
      <div className="canvas-header header-navbar" style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onBack}
          style={{
            padding: '8px 16px',
            borderRadius: '12px',
            background: 'rgba(13, 17, 23, 0.9)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '1.1rem' }}>
          {board?.name || 'System Design Canvas'}
        </span>
      </div>

      {/* Production Mode Floating Under Development Banner */}
      {!checkIsDevMode() && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            background: 'rgba(245, 158, 11, 0.15)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '30px',
            padding: '7px 20px',
            color: '#fef08a',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
          }}
        >
          <AlertTriangle size={16} color="#f59e0b" />
          <span>System Design Canvas is currently under active development</span>
        </div>
      )}

      {/* Empty Canvas Workspace - Ready for custom system design features */}
    </div>
  );
}
