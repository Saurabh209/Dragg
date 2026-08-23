import React from 'react';
import { Plus, StickyNote, Code2, Image, Layers, Trash2, Lock, Unlock } from 'lucide-react';

export default function FreestyleContextMenu({ position, onClose, onAddCard, onGroupSelected, onDeleteSelected }) {
  if (!position) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '12px',
        padding: '6px',
        width: '180px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#64748b', padding: '4px 8px', letterSpacing: '0.05em' }}>
        FREESTYLE ACTIONS
      </div>

      <button
        className="menu-item-btn"
        onClick={() => { onAddCard('note'); onClose(); }}
        style={btnStyle}
      >
        <StickyNote size={14} color="#a855f7" /> Add Note
      </button>

      <button
        className="menu-item-btn"
        onClick={() => { onAddCard('code'); onClose(); }}
        style={btnStyle}
      >
        <Code2 size={14} color="#3b82f6" /> Add Code Block
      </button>

      <button
        className="menu-item-btn"
        onClick={() => { onAddCard('image'); onClose(); }}
        style={btnStyle}
      >
        <Image size={14} color="#10b981" /> Upload Image
      </button>

      <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

      {onGroupSelected && (
        <button className="menu-item-btn" onClick={() => { onGroupSelected(); onClose(); }} style={btnStyle}>
          <Layers size={14} color="#f59e0b" /> Group Selection
        </button>
      )}

      {onDeleteSelected && (
        <button className="menu-item-btn" onClick={() => { onDeleteSelected(); onClose(); }} style={{ ...btnStyle, color: '#f43f5e' }}>
          <Trash2 size={14} /> Delete Selected
        </button>
      )}
    </div>
  );
}

const btnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'transparent',
  border: 'none',
  borderRadius: '6px',
  padding: '6px 10px',
  color: '#e2e8f0',
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%'
};
