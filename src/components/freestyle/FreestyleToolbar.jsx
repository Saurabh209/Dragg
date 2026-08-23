import React from 'react';
import { MousePointer, StickyNote, Code2, Image, PenTool, Eraser, Move, Undo, Redo, ZoomIn, ZoomOut } from 'lucide-react';

export default function FreestyleToolbar({ toolMode, onChangeTool, onAddNote, onAddCode, onUploadImage, onUndo, onRedo, canUndo, canRedo }) {
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
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)'
      }}
    >
      <button
        style={{ ...toolBtnStyle, background: toolMode === 'select' ? '#6366f1' : 'transparent' }}
        onClick={() => onChangeTool('select')}
        title="Select & Move (V)"
      >
        <MousePointer size={18} color="#ffffff" />
      </button>

      <button style={toolBtnStyle} onClick={onAddNote} title="Add Note">
        <StickyNote size={18} color="#a855f7" />
      </button>

      <button style={toolBtnStyle} onClick={onAddCode} title="Add Code Block">
        <Code2 size={18} color="#3b82f6" />
      </button>

      <button style={toolBtnStyle} onClick={onUploadImage} title="Upload Image">
        <Image size={18} color="#10b981" />
      </button>

      <button
        style={{ ...toolBtnStyle, background: toolMode === 'draw' ? '#6366f1' : 'transparent' }}
        onClick={() => onChangeTool('draw')}
        title="Freehand Sketching"
      >
        <PenTool size={18} color="#f59e0b" />
      </button>

      <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />

      <button style={toolBtnStyle} onClick={onUndo} disabled={!canUndo} title="Undo">
        <Undo size={16} color={canUndo ? '#ffffff' : '#64748b'} />
      </button>
      <button style={toolBtnStyle} onClick={onRedo} disabled={!canRedo} title="Redo">
        <Redo size={16} color={canRedo ? '#ffffff' : '#64748b'} />
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
