import React from 'react';
import {
  MapPin,
  FileText,
  Square,
  Circle,
  Monitor,
  CloudUpload,
  GitFork,
  Scale,
  Cloud,
  Server,
  Sun,
  Database,
  Zap,
  Package,
  Layers,
  FastForward,
  Clock,
  X,
  Code2,
  Container,
  HelpCircle
} from 'lucide-react';

const CATEGORIES = [
  {
    title: 'DECORATION',
    items: [
      { id: 'start_here', name: 'Start here', icon: MapPin, color: '#a855f7', category: 'Decoration' },
    ]
  },
  {
    title: 'PLANNING',
    items: [
      { id: 'sticky', name: 'Sticky', icon: FileText, color: '#a855f7', category: 'Planning' },
      { id: 'group', name: 'Group / Container', icon: Container, color: '#a855f7', category: 'Planning' },
      { id: 'custom_node', name: 'Node', icon: Square, color: '#a855f7', category: 'Planning' },
    ]
  },
  {
    title: 'SURFACE',
    items: [
      { id: 'frontend', name: 'Frontend', icon: Monitor, color: '#06b6d4', category: 'Surface' },
    ]
  },
  {
    title: 'TRAFFIC',
    items: [
      { id: 'ext_service', name: 'External Service', icon: CloudUpload, color: '#10b981', category: 'Traffic' },
      { id: 'api_gateway', name: 'API Gateway', icon: GitFork, color: '#10b981', category: 'Traffic' },
      { id: 'load_balancer', name: 'Load Balancer', icon: Scale, color: '#10b981', category: 'Traffic' },
      { id: 'cdn', name: 'CDN', icon: Cloud, color: '#10b981', category: 'Traffic' },
    ]
  },
  {
    title: 'COMPUTE',
    items: [
      { id: 'api_server', name: 'API Server', icon: Server, color: '#f59e0b', category: 'Compute' },
      { id: 'worker', name: 'Worker', icon: Sun, color: '#f59e0b', category: 'Compute' },
    ]
  },
  {
    title: 'DATA',
    items: [
      { id: 'database', name: 'Database', icon: Database, color: '#3b82f6', category: 'Data' },
      { id: 'cache', name: 'Cache', icon: Zap, color: '#3b82f6', category: 'Data' },
      { id: 'blob_storage', name: 'Blob Storage', icon: Package, color: '#3b82f6', category: 'Data' },
    ]
  },
  {
    title: 'ASYNC',
    items: [
      { id: 'queue', name: 'Queue', icon: Layers, color: '#ec4899', category: 'Async' },
      { id: 'stream', name: 'Stream', icon: FastForward, color: '#ec4899', category: 'Async' },
      { id: 'scheduler', name: 'Scheduler', icon: Clock, color: '#ec4899', category: 'Async' },
    ]
  },
  {
    title: 'CODE & SHAPES',
    items: [
      { id: 'code_card', name: 'Code Storage Card', icon: Code2, color: '#6366f1', category: 'Code' },
      { id: 'shape_square', name: 'Square / Rect', icon: Square, color: '#8b5cf6', category: 'Shapes' },
      { id: 'shape_circle', name: 'Circle', icon: Circle, color: '#8b5cf6', category: 'Shapes' },
    ]
  }
];

export default function SystemDesignCatalogModal({ isOpen, onClose, onSelectNode }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: 'rgba(5, 7, 15, 0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '380px',
          maxHeight: '85vh',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
              System Architecture Nodes
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {CATEGORIES.map((cat) => (
            <div key={cat.title} style={{ marginBottom: '20px' }}>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: '#94a3b8',
                  marginBottom: '10px'
                }}
              >
                {cat.title}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '12px'
                }}
              >
                {cat.items.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectNode(item);
                        onClose();
                      }}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '10px 4px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        gap: '6px'
                      }}
                    >
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          background: `${item.color}15`,
                          color: item.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1px solid ${item.color}30`
                        }}
                      >
                        <IconComponent size={20} />
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          color: '#475569',
                          textAlign: 'center',
                          lineHeight: '1.1',
                          maxWidth: '70px',
                          wordBreak: 'break-word'
                        }}
                      >
                        {item.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            fontSize: '0.75rem',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <HelpCircle size={14} color="#94a3b8" />
          <span>Tip: Click on canvas to add a node</span>
        </div>
      </div>
    </div>
  );
}
