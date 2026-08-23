import React from 'react';
import { Server, Activity } from 'lucide-react';

export default function SystemMicroserviceNode({ node, onOpenInspector }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '12px',
        background: '#111827',
        borderRadius: '12px',
        border: '1.5px solid #10b981',
        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
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
          <Server size={18} color="#10b981" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{node.title || 'Microservice'}</span>
        </div>
        <Activity size={14} color="#10b981" />
      </div>

      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '8px' }}>
        <div>CPU: 2 Cores | RAM: 4GB</div>
        <div>Replicas: 3 Instances</div>
      </div>
    </div>
  );
}
