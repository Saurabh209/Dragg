import React from 'react';
import { GitFork, ShieldCheck } from 'lucide-react';

export default function SystemGatewayNode({ node, onOpenInspector }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        padding: '12px',
        background: '#0f172a',
        borderRadius: '12px',
        border: '1.5px solid #3b82f6',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
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
          <GitFork size={18} color="#60a5fa" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{node.title || 'API Gateway'}</span>
        </div>
        <ShieldCheck size={14} color="#60a5fa" />
      </div>

      <div style={{ fontSize: '0.75rem', color: '#93c5fd', marginTop: '8px' }}>
        <div>Layer 7 Routing</div>
        <div>Rate Limiting & TLS Term</div>
      </div>
    </div>
  );
}
