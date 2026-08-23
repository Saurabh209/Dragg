import React from 'react';
import { MousePointer, Server, Database, GitFork, Sliders, LayoutGrid, Layers, Plus } from 'lucide-react';

export default function SystemDesignToolbar({ toolMode, onChangeTool, onOpenCatalog, onAddNode }) {
  return (
    <div
      className="glass"
      style={{
        position: 'fixed',
        left: '20px',
        top: '180px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 8px',
        borderRadius: '16px',
        background: 'rgba(13, 17, 23, 0.9)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
      }}
    >
      <button
        style={{ ...toolBtnStyle, background: toolMode === 'select' ? '#3b82f6' : 'transparent' }}
        onClick={() => onChangeTool('select')}
        title="Select & Route (V)"
      >
        <MousePointer size={18} color="#ffffff" />
      </button>

      <button style={toolBtnStyle} onClick={onOpenCatalog} title="Open Architecture Catalog">
        <Plus size={18} color="#06b6d4" />
      </button>

      <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />

      <button style={toolBtnStyle} onClick={() => onAddNode('microservice')} title="Add Microservice">
        <Server size={18} color="#10b981" />
      </button>

      <button style={toolBtnStyle} onClick={() => onAddNode('database')} title="Add Database">
        <Database size={18} color="#8b5cf6" />
      </button>

      <button style={toolBtnStyle} onClick={() => onAddNode('gateway')} title="Add API Gateway">
        <GitFork size={18} color="#3b82f6" />
      </button>
    </div>
  );
}

const toolBtnStyle = {
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  border: 'none',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s ease'
};
