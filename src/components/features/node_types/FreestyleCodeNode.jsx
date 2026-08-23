import React from 'react';
import { Code2 } from 'lucide-react';

export default function FreestyleCodeNode({ card, onOpenModal }) {
  return (
    <div
      onClick={() => onOpenModal && onOpenModal(card)}
      style={{
        width: '100%',
        height: '100%',
        padding: '12px',
        background: '#090d16',
        borderRadius: '12px',
        color: '#38bdf8',
        fontFamily: 'Consolas, monospace',
        fontSize: '0.85rem',
        cursor: 'pointer',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#94a3b8', fontSize: '0.75rem' }}>
        <Code2 size={14} color="#6366f1" />
        <span style={{ fontWeight: 600, color: '#f8fafc' }}>{card.title || 'Code Snippet'}</span>
      </div>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {card.code || card.content || '// Double click to view full code editor'}
      </pre>
    </div>
  );
}
