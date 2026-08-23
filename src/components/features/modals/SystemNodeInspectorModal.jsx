import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, Settings2, Sliders } from 'lucide-react';

export default function SystemNodeInspectorModal({ isOpen, onClose, node, onSaveConfig }) {
  if (!isOpen || !node) return null;

  const [name, setName] = useState(node.title || node.name || 'Component');
  const [description, setDescription] = useState(node.description || '');
  const [tags, setTags] = useState(node.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);

  const [config, setConfig] = useState(
    node.systemConfig || {
      layer: 'Layer 7',
      strategy: 'Round robin',
      healthChecks: 'Active',
      sessionAffinity: 'None',
      failover: 'Multi-zone',
      scheduleType: 'Cron',
      scheduleCron: '0 0 * * *',
      timezone: 'UTC',
      overlap: 'Skip',
      missedRuns: 'Run once',
      retryPolicy: 'None',
      dbEngine: 'PostgreSQL',
      replication: 'Primary-Replica',
      sharding: 'Disabled',
      cacheEngine: 'Redis',
      evictionPolicy: 'LRU',
      queueEngine: 'RabbitMQ',
      deliveryGuarantee: 'At-least-once'
    }
  );

  useEffect(() => {
    if (node) {
      setName(node.title || node.name || 'Component');
      setDescription(node.description || '');
      setTags(node.tags || []);
      if (node.systemConfig) {
        setConfig(node.systemConfig);
      }
    }
  }, [node]);

  const handleAddTag = () => {
    if (newTagInput.trim() && tags.length < 6) {
      setTags([...tags, newTagInput.trim()]);
      setNewTagInput('');
      setShowAddTag(false);
    }
  };

  const handleRemoveTag = (indexToRemove) => {
    setTags(tags.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = () => {
    onSaveConfig(node.id, {
      title: name,
      description,
      tags,
      systemConfig: config,
      isConfigured: true
    });
    onClose();
  };

  const nodeType = node.nodeType || node.id || 'custom';

  const updateConfig = (key, val) => {
    setConfig((prev) => ({ ...prev, [key]: val }));
  };

  const renderPillGroup = (key, options) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
      {options.map((opt) => {
        const isSelected = config[key] === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => updateConfig(key, opt)}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              border: isSelected ? '1.5px solid #10b981' : '1px solid #e2e8f0',
              background: isSelected ? '#ecfdf5' : '#ffffff',
              color: isSelected ? '#047857' : '#475569',
              fontSize: '0.8rem',
              fontWeight: isSelected ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                border: isSelected ? '4px solid #10b981' : '1.5px solid #cbd5e1',
                boxSizing: 'border-box'
              }}
            />
            {opt}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '560px',
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '20px 24px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: '#94a3b8',
                textTransform: 'uppercase',
                marginBottom: '4px'
              }}
            >
              INSPECTOR
            </div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>
              {name || 'Component Config'}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '6px',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Name</label>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{name.length}/50</span>
              </div>
              <input
                type="text"
                value={name}
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>Description</label>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{description.length}/250</span>
              </div>
              <input
                type="text"
                value={description}
                maxLength={250}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Routes traffic, caches items..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.85rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: '14px',
              background: '#f8fafc',
              border: '1px solid #f1f5f9',
              marginBottom: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', letterSpacing: '0.05em' }}>
                  TAGS
                </span>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>Custom labels for workflow.</p>
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{tags.length}/6</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {tags.map((t, i) => (
                <span
                  key={i}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: '#e0e7ff',
                    color: '#3730a3',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {t}
                  <X size={12} style={{ cursor: 'pointer' }} onClick={() => handleRemoveTag(i)} />
                </span>
              ))}

              {showAddTag ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="text"
                    autoFocus
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Tag name"
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #6366f1',
                      fontSize: '0.75rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleAddTag}
                    style={{
                      background: '#4f46e5',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      cursor: 'pointer',
                      fontSize: '0.75rem'
                    }}
                  >
                    Add
                  </button>
                </div>
              ) : (
                tags.length < 6 && (
                  <button
                    onClick={() => setShowAddTag(true)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      background: '#0f172a',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={12} /> Add tag
                  </button>
                )
              )}
            </div>
          </div>

          <div
            style={{
              padding: '20px',
              borderRadius: '16px',
              border: '1px dashed #cbd5e1',
              background: '#ffffff'
            }}
          >
            {nodeType === 'load_balancer' && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', letterSpacing: '0.05em', marginBottom: '14px' }}>
                  TRAFFIC DISTRIBUTION
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Layer</label>
                  {renderPillGroup('layer', ['Layer 7', 'Layer 4'])}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Strategy</label>
                  {renderPillGroup('strategy', ['Round robin', 'Least conn.', 'Latency', 'Hash'])}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Health checks</label>
                  {renderPillGroup('healthChecks', ['Active', 'Passive', 'Active + passive'])}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Session affinity</label>
                  {renderPillGroup('sessionAffinity', ['None', 'Cookie', 'IP hash'])}
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Failover</label>
                  {renderPillGroup('failover', ['Single zone', 'Multi-zone', 'Multi-region'])}
                </div>
              </div>
            )}

            {nodeType === 'scheduler' && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', letterSpacing: '0.05em', marginBottom: '14px' }}>
                  SCHEDULE POLICY
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Schedule type</label>
                  {renderPillGroup('scheduleType', ['Cron', 'Interval', 'Manual'])}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Schedule (Cron)</label>
                    <input
                      type="text"
                      value={config.scheduleCron}
                      onChange={(e) => updateConfig('scheduleCron', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace',
                        marginTop: '4px'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Timezone</label>
                    <input
                      type="text"
                      value={config.timezone}
                      onChange={(e) => updateConfig('timezone', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.85rem',
                        marginTop: '4px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Overlap</label>
                  {renderPillGroup('overlap', ['Skip', 'Queue', 'Allow', 'Replace'])}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Missed runs</label>
                  {renderPillGroup('missedRuns', ['Ignore', 'Run once', 'Catch up'])}
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Retry policy</label>
                  {renderPillGroup('retryPolicy', ['None', 'Fixed', 'Exponential'])}
                </div>
              </div>
            )}

            {nodeType !== 'load_balancer' && nodeType !== 'scheduler' && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', letterSpacing: '0.05em', marginBottom: '14px' }}>
                  ARCHITECTURE CONFIGURATION
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Primary Engine / Protocol</label>
                  {renderPillGroup('dbEngine', ['PostgreSQL', 'Redis', 'Kafka', 'REST', 'gRPC'])}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Replication & Scaling</label>
                  {renderPillGroup('replication', ['Single Instance', 'Primary-Replica', 'Multi-Region Sharding'])}
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <button
            onClick={() => setConfig({})}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#64748b',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Clear config
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 20px',
                borderRadius: '10px',
                border: 'none',
                background: '#0f172a',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)'
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
