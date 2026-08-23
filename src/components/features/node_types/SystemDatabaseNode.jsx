import React from 'react';
import { Database, HardDrive } from 'lucide-react';

export default function SystemDatabaseNode({ node, onOpenInspector }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '12px',
        background: '#1e1b4b',
        borderRadius: '12px',
        border: '1.5px solid #8b5cf6',
        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        cursor: 'pointer',
        boxSizing: 'border-box'
      }}
      onClick={() => onOpenInspector && onOpenInspector(node)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={18} color="#a78bfa" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{node.title || 'Database Node'}</span>
        </div>
        <HardDrive size={14} color="#a78bfa" />
      </div>

      <div style={{ fontSize: '0.75rem', color: '#c7d2fe', marginTop: '8px' }}>
        <div>Engine: PostgreSQL</div>
        <div>Primary-Replica Sharding</div>
      </div>
    </div>
  );
}
