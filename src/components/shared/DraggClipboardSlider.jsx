import React, { useState, useEffect } from 'react';
import { Clipboard, Copy, Trash2, X, Sparkles, Plus, Check, Clock, Layers, ChevronUp, Bell, Pin, MoreHorizontal, Smile, Heart, BoxSelect } from 'lucide-react';
import { getDraggItem, setDraggItem } from '../../utils/draggStorage';

const MAX_CLIPBOARD_ITEMS = 4;

export const getDraggClipboardItems = () => {
  try {
    return getDraggItem('clipboardItems', []);
  } catch (err) {
    console.error('Error reading dragg clipboard:', err);
    return [];
  }
};

export const saveDraggClipboardItems = (items) => {
  try {
    const capped = items.slice(0, MAX_CLIPBOARD_ITEMS);
    setDraggItem('clipboardItems', capped);
    window.dispatchEvent(new CustomEvent('dragg-clipboard-updated'));
    return capped;
  } catch (err) {
    console.error('Error saving dragg clipboard:', err);
    return [];
  }
};

export const copyToDraggClipboard = (cardsToCopy, connectionsToCopy = [], preset = 'freestyle', previewImage = null) => {
  if (!cardsToCopy || cardsToCopy.length === 0) return null;

  const currentItems = getDraggClipboardItems();
  
  // Calculate summary title
  const firstTitle = cardsToCopy[0]?.title || cardsToCopy[0]?.name || 'Card';
  let summaryTitle = '';
  if (cardsToCopy.length === 1) {
    summaryTitle = `1 Card: "${firstTitle.substring(0, 24)}${firstTitle.length > 24 ? '...' : ''}"`;
  } else {
    summaryTitle = `${cardsToCopy.length} Cards ("${firstTitle.substring(0, 16)}..." + ${cardsToCopy.length - 1} more)`;
  }

  // Deep clone card data
  const clonedCards = JSON.parse(JSON.stringify(cardsToCopy));
  
  // Find valid connections between selected cards
  const cardIdSet = new Set(clonedCards.map(c => c.id));
  const validConnections = (connectionsToCopy || []).filter(
    conn => cardIdSet.has(conn.fromCardId) && cardIdSet.has(conn.toCardId)
  );
  const clonedConnections = JSON.parse(JSON.stringify(validConnections));

  const newItem = {
    id: 'clip_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
    title: summaryTitle,
    preset,
    cardCount: clonedCards.length,
    connCount: clonedConnections.length,
    cards: clonedCards,
    connections: clonedConnections,
    previewImage
  };

  // Prepend new item, max 4 items (FIFO queue: 5th item drops the oldest at the end)
  const updatedList = [newItem, ...currentItems].slice(0, MAX_CLIPBOARD_ITEMS);
  saveDraggClipboardItems(updatedList);
  return newItem;
};

// Mini Canvas Replica Preview Component for Copied Cards & Connections
function DraggClipMiniCanvasPreview({ cards = [], connections = [] }) {
  if (!cards || cards.length === 0) return null;

  const xs = cards.map(c => c.x || 0);
  const ys = cards.map(c => c.y || 0);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...cards.map(c => (c.x || 0) + (c.width || 220)));
  const maxY = Math.max(...cards.map(c => (c.y || 0) + (c.height || 160)));

  const contentW = Math.max(maxX - minX, 160);
  const contentH = Math.max(maxY - minY, 120);

  const containerW = 140;
  const containerH = 75;

  const scale = Math.min((containerW - 16) / contentW, (containerH - 16) / contentH, 0.45);

  const cardMap = {};
  cards.forEach(c => {
    cardMap[c.id] = {
      cx: ((c.x || 0) - minX) * scale + 10 + ((c.width || 220) * scale) / 2,
      cy: ((c.y || 0) - minY) * scale + 10 + ((c.height || 160) * scale) / 2
    };
  });

  const getCardColor = (c) => {
    const colMap = {
      indigo: '#6366f1',
      cyan: '#06b6d4',
      emerald: '#10b981',
      amber: '#f59e0b',
      rose: '#f43f5e',
      slate: '#64748b'
    };
    if (c.color && colMap[c.color]) return colMap[c.color];
    if (c.preset === 'system_design' || c.type === 'system_node') return '#06b6d4';
    return '#6366f1';
  };

  return (
    <div
      style={{
        width: `${containerW}px`,
        height: `${containerH}px`,
        position: 'relative',
        background: 'rgba(10, 15, 26, 0.85)',
        borderRadius: '10px',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 12px rgba(0,0,0,0.6)',
        flexShrink: 0
      }}
    >
      {/* Micro Grid Dots */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(56, 189, 248, 0.25) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
          opacity: 0.6
        }}
      />

      {/* Mini SVG Connections */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {connections.map((conn, i) => {
          const fromPos = cardMap[conn.fromCardId];
          const toPos = cardMap[conn.toCardId];
          if (!fromPos || !toPos) return null;
          return (
            <line
              key={conn.id || i}
              x1={fromPos.cx}
              y1={fromPos.cy}
              x2={toPos.cx}
              y2={toPos.cy}
              stroke={conn.color || '#38bdf8'}
              strokeWidth="1.5"
              strokeDasharray={conn.style === 'dashed' ? '2 2' : 'none'}
              opacity="0.8"
            />
          );
        })}
      </svg>

      {/* Mini Cards Replica */}
      {cards.map((c) => {
        const left = ((c.x || 0) - minX) * scale + 8;
        const top = ((c.y || 0) - minY) * scale + 8;
        const w = Math.max((c.width || 220) * scale, 34);
        const h = Math.max((c.height || 160) * scale, 22);
        const color = getCardColor(c);
        const titleText = c.title || c.name || 'Card';

        return (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${w}px`,
              height: `${h}px`,
              background: `linear-gradient(135deg, ${color}25 0%, rgba(15, 23, 42, 0.92) 100%)`,
              border: `1px solid ${color}aa`,
              borderRadius: '5px',
              padding: '2px 4px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxShadow: `0 2px 5px ${color}33`
            }}
          >
            <div
              style={{
                fontSize: '0.52rem',
                fontWeight: 700,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1
              }}
            >
              {titleText}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DraggClipboardSlider({ isOpen, onClose, onPasteItem, showToast, bgColor = '#0a0a0c' }) {
  const [items, setItems] = useState(getDraggClipboardItems());
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
      return getDraggItem('clipboardPinned', []);
    } catch {
      return [];
    }
  });
  const [selectedId, setSelectedId] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      const newItems = getDraggClipboardItems();
      setItems(newItems);
      if (newItems.length > 0 && !selectedId) {
        setSelectedId(newItems[0].id);
      }
    };
    window.addEventListener('dragg-clipboard-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('dragg-clipboard-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [selectedId]);

  useEffect(() => {
    if (items.length > 0 && !selectedId) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 260);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCloseShade = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  };

  if (!shouldRender) return null;

  const togglePin = (id, e) => {
    e.stopPropagation();
    const updated = pinnedIds.includes(id)
      ? pinnedIds.filter(pId => pId !== id)
      : [...pinnedIds, id];
    setPinnedIds(updated);
    try {
      setDraggItem('clipboardPinned', updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteItem = (id, e) => {
    e.stopPropagation();
    const updated = items.filter(item => item.id !== id);
    saveDraggClipboardItems(updated);
    if (selectedId === id) {
      setSelectedId(updated[0]?.id || null);
    }
    if (showToast) showToast('Item removed from clipboard');
  };

  const handleClearAll = () => {
    // Keep pinned items if any
    const pinnedItems = items.filter(item => pinnedIds.includes(item.id));
    saveDraggClipboardItems(pinnedItems);
    if (showToast) showToast('Cleared unpinned items');
  };

  const sortedItems = [...items].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.id);
    const bPinned = pinnedIds.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

  return (
    <>
      {/* Transparent Click-Outside Overlay (No Canvas Blur/Darkening) */}
      <div
        onClick={handleCloseShade}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'transparent',
          zIndex: 9998
        }}
      />

      {/* Top Navbar Glass Theme Clipboard Popover Container */}
      <div
        className="glass"
        style={{
          position: 'fixed',
          top: '0rem',
          right: '0rem',
          zIndex: 9999,
          width: 'min(92vw, 360px)',
          background: typeof bgColor === 'string' && bgColor.startsWith('#') ? (bgColor.length === 7 ? `${bgColor}e6` : bgColor) : (bgColor || 'rgba(10, 10, 15, 0.95)'),
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '0px 0px 0px 12px',
          color: '#f8fafc',
          padding: '14px 16px 12px 16px',
          animation: isClosing ? 'draggNotifShadeSlideUp 0.26s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'draggNotifShadeSlideDown 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          fontFamily: 'Inter, Segoe UI, system-ui, -apple-system, sans-serif'
        }}
      >
        <style>{`
          @keyframes draggFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes draggFadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
          }
          @keyframes draggNotifShadeSlideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
          }
          @keyframes draggNotifShadeSlideUp {
            from { transform: translateY(0); }
            to { transform: translateY(-100%); }
          }
          .win-clipboard-card {
            transition: all 0.15s ease;
          }
          .win-clipboard-card:hover {
            border-color: #38bdf8 !important;
            background: rgba(30, 41, 59, 0.6) !important;
          }
        `}</style>

        {/* 1. Header Row: "Emoji and more" */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc', fontSize: '0.85rem', fontWeight: 600 }}>
            <span>Emoji and more</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', opacity: 0.5 }}>
              <BoxSelect size={12} />
              <span style={{ fontSize: '0.65rem' }}>°</span>
            </div>
          </div>
          <button
            onClick={handleCloseShade}
            style={{
              background: 'rgba(18, 18, 24, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* 2. Top Icon Tab Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', marginBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <Heart size={15} color="#94a3b8" style={{ cursor: 'pointer', opacity: 0.7 }} />
          <Smile size={15} color="#94a3b8" style={{ cursor: 'pointer', opacity: 0.7 }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '3px', padding: '1px 3px', cursor: 'pointer' }}>GIF</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#94a3b8', cursor: 'pointer', opacity: 0.7 }}>;-)</span>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', cursor: 'pointer', opacity: 0.7 }}>%Δ+</span>
          
          {/* Active Navbar Styled Clipboard Tab Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(56, 189, 248, 0.18)',
              border: '1px solid #38bdf8',
              borderRadius: '6px',
              padding: '3px 8px',
              color: '#38bdf8',
              fontSize: '0.72rem',
              fontWeight: 700
            }}
          >
            <Clipboard size={13} color="#38bdf8" />
            <span>Clip</span>
          </div>
        </div>

        {/* 3. Subheader: "Clipboard" & "Clear all" */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>Clipboard</span>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                background: 'rgba(18, 18, 24, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                color: 'var(--color-text-main)',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0.35rem 0.55rem',
                borderRadius: '6px',
                transition: 'all 0.15s'
              }}
              onMouseEnter={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.05)'}
            >
              Clear all
            </button>
          )}
        </div>

        {/* 4. Clipboard Cards List */}
        {sortedItems.length === 0 ? (
          <div style={{ padding: '20px 12px', textAlign: 'center', color: '#64748b' }}>
            <Clipboard size={24} style={{ marginBottom: '6px', opacity: 0.5, color: '#38bdf8' }} />
            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Clipboard is empty</p>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Copied elements or text snippets will appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto', paddingRight: '2px' }}>
            {sortedItems.map((item, idx) => {
              const isPinned = pinnedIds.includes(item.id);
              const isSelected = selectedId === item.id || (!selectedId && idx === 0);

              return (
                <div
                  key={item.id}
                  className="win-clipboard-card"
                  onClick={() => {
                    setSelectedId(item.id);
                    if (onPasteItem) onPasteItem(item);
                    setCopiedIndex(idx);
                    setTimeout(() => setCopiedIndex(null), 1200);
                  }}
                  style={{
                    position: 'relative',
                    background: isSelected ? 'rgba(30, 41, 59, 0.7)' : 'rgba(18, 18, 24, 0.4)',
                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.05)',
                    boxShadow: isSelected ? '0 0 12px rgba(56, 189, 248, 0.25)' : 'none',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '70px',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Card Content Text & Three dots menu button */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#ffffff', wordBreak: 'break-word', lineHeight: '1.3' }}>
                      {item.title || 'Copied Item'}
                    </span>

                    <button
                      onClick={(e) => handleDeleteItem(item.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        opacity: 0.7
                      }}
                      title="Remove item"
                      onMouseEnter={(e) => e.target.style.color = '#f43f5e'}
                      onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </div>

                  {/* Card Footer: Metadata info & Pin Icon */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', opacity: 0.8 }}>
                      {item.cardCount > 0 ? `${item.cardCount} card${item.cardCount > 1 ? 's' : ''}` : 'Clip item'}
                    </span>

                    <button
                      onClick={(e) => togglePin(item.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: isPinned ? '#38bdf8' : '#94a3b8',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        transform: isPinned ? 'rotate(-45deg)' : 'none',
                        transition: 'all 0.15s'
                      }}
                      title={isPinned ? 'Unpin' : 'Pin to top'}
                      onMouseEnter={(e) => e.target.style.color = '#38bdf8'}
                      onMouseLeave={(e) => e.target.style.color = isPinned ? '#38bdf8' : '#94a3b8'}
                    >
                      <Pin size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
