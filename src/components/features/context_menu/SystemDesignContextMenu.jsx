import React from 'react';
import { Plus, Server, Database, GitFork, Sliders, Layers, Trash2 } from 'lucide-react';

export default function SystemDesignContextMenu({ position, onClose, onAddNode, onOpenCatalog, onDeleteSelected }) {
  if (!position) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        zIndex: 99999,
        background: 'rgba(13, 17, 23, 0.95)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '12px',
        padding: '6px',
        width: '200px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#38bdf8', padding: '4px 8px', letterSpacing: '0.05em' }}>
        SYSTEM DESIGN ACTIONS
      </div>

      <button className="menu-item-btn" onClick={() => { onOpenCatalog(); onClose(); }} style={btnStyle}>
        <Plus size={14} color="#06b6d4" /> Open Node Catalog
      </button>

      <button className="menu-item-btn" onClick={() => { onAddNode('microservice'); onClose(); }} style={btnStyle}>
        <Server size={14} color="#10b981" /> Add Microservice
      </button>

      <button className="menu-item-btn" onClick={() => { onAddNode('database'); onClose(); }} style={btnStyle}>
        <Database size={14} color="#8b5cf6" /> Add Database Node
      </button>

      <button className="menu-item-btn" onClick={() => { onAddNode('gateway'); onClose(); }} style={btnStyle}>
        <GitFork size={14} color="#3b82f6" /> Add API Gateway
      </button>

      <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

      {onDeleteSelected && (
        <button className="menu-item-btn" onClick={() => { onDeleteSelected(); onClose(); }} style={{ ...btnStyle, color: '#f43f5e' }}>
          <Trash2 size={14} /> Delete Selected Node
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
