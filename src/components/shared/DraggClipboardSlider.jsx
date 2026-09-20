import React, { useState, useEffect } from 'react';
import { Clipboard, Copy, Trash2, X, Sparkles, Plus, Check, Clock, Layers, ChevronUp, Bell, Pin, MoreHorizontal, Smile, Heart, BoxSelect } from 'lucide-react';
import { getDraggItem, setDraggItem } from '../../utils/draggStorage';

const MAX_CLIPBOARD_ITEMS = 6;

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
    summaryTitle = `${firstTitle.substring(0, 26)}${firstTitle.length > 26 ? '...' : ''}`;
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

  // Prepend new item, capped at MAX_CLIPBOARD_ITEMS
  const updatedList = [newItem, ...currentItems].slice(0, MAX_CLIPBOARD_ITEMS);
  saveDraggClipboardItems(updatedList);
  return newItem;
};

// Mini Canvas Replica Preview Component for Copied Cards & Connections (Windows Hover Preview Style)
function DraggClipMiniCanvasPreview({ cards = [], connections = [] }) {
  if (!cards || cards.length === 0) return null;

  const xs = cards.map(c => c.x || 0);
  const ys = cards.map(c => c.y || 0);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...cards.map(c => (c.x || 0) + (c.width || 220)));
  const maxY = Math.max(...cards.map(c => (c.y || 0) + (c.height || 160)));

  const contentW = Math.max(maxX - minX, 180);
  const contentH = Math.max(maxY - minY, 130);

  const containerH = 110;
  const scale = Math.min(280 / contentW, (containerH - 20) / contentH, 0.55);

  const cardMap = {};
  cards.forEach(c => {
    cardMap[c.id] = {
      cx: ((c.x || 0) - minX) * scale + 14 + ((c.width || 220) * scale) / 2,
      cy: ((c.y || 0) - minY) * scale + 14 + ((c.height || 160) * scale) / 2
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
        width: '100%',
        height: `${containerH}px`,
        position: 'relative',
        background: 'rgba(9, 13, 22, 0.95)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 16px rgba(0, 0, 0, 0.8)',
        boxSizing: 'border-box'
      }}
    >
      {/* Micro Grid Dots */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(56, 189, 248, 0.25) 1px, transparent 1px)',
          backgroundSize: '10px 10px',
          opacity: 0.5
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
              strokeWidth="2"
              strokeDasharray={conn.style === 'dashed' ? '3 3' : 'none'}
              opacity="0.85"
            />
          );
        })}
      </svg>

      {/* Mini Cards Replica */}
      {cards.map((c) => {
        const left = ((c.x || 0) - minX) * scale + 10;
        const top = ((c.y || 0) - minY) * scale + 10;
        const w = Math.max((c.width || 220) * scale, 42);
        const h = Math.max((c.height || 160) * scale, 28);
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
              background: `linear-gradient(135deg, ${color}33 0%, rgba(15, 23, 42, 0.95) 100%)`,
              border: `1.5px solid ${color}dd`,
              borderRadius: '6px',
              padding: '3px 5px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxShadow: `0 3px 8px ${color}44, 0 1px 3px rgba(0,0,0,0.6)`
            }}
          >
            <div
              style={{
                fontSize: '0.58rem',
                fontWeight: 700,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.1
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
    setItems(updated);
    if (selectedId === id) {
      setSelectedId(updated[0]?.id || null);
    }
    if (showToast) showToast('Item removed from clipboard');
  };

  const handleClearAll = () => {
    // Keep pinned items when user clicks Clear All
    const pinnedItems = items.filter(item => pinnedIds.includes(item.id));
    saveDraggClipboardItems(pinnedItems);
    setItems(pinnedItems);
    if (selectedId && !pinnedIds.includes(selectedId)) {
      setSelectedId(pinnedItems[0]?.id || null);
    }
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
      {/* Transparent Click-Outside Overlay */}
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
          width: 'min(94vw, 360px)',
          background: typeof bgColor === 'string' && bgColor.startsWith('#') ? (bgColor.length === 7 ? `${bgColor}e6` : bgColor) : (bgColor || 'rgba(10, 10, 15, 0.95)'),
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '0px 0px 0px 14px',
          color: '#f8fafc',
          padding: '14px 16px 14px 16px',
          animation: isClosing ? 'draggNotifShadeSlideUp 0.26s cubic-bezier(0.4, 0, 0.2, 1) forwards' : 'draggNotifShadeSlideDown 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          fontFamily: 'Inter, Segoe UI, system-ui, -apple-system, sans-serif'
        }}
      >
        <style>{`
          @keyframes draggNotifShadeSlideDown {
            from { transform: translateY(-100%); }
            to { transform: translateY(0); }
          }
          @keyframes draggNotifShadeSlideUp {
            from { transform: translateY(0); }
            to { transform: translateY(-100%); }
          }
          .win-clipboard-card {
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .win-clipboard-card:hover {
            border-color: rgba(56, 189, 248, 0.5) !important;
            background: rgba(30, 41, 59, 0.8) !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5), 0 0 12px rgba(56, 189, 248, 0.15) !important;
          }
          .clipboard-action-btn {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 6px;
            color: #94a3b8;
            cursor: pointer;
            padding: 4px 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.15s ease;
          }
          .clipboard-action-btn:hover {
            background: rgba(56, 189, 248, 0.15);
            border-color: rgba(56, 189, 248, 0.4);
            color: #38bdf8;
          }
          .clipboard-action-btn.delete-btn:hover {
            background: rgba(244, 63, 94, 0.15);
            border-color: rgba(244, 63, 94, 0.4);
            color: #f43f5e;
          }
          .clipboard-action-btn.is-pinned {
            background: rgba(56, 189, 248, 0.15);
            border-color: rgba(56, 189, 248, 0.4);
          }
        `}</style>

        {/* Clean Header Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', marginBottom: '12px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clipboard size={15} color="#38bdf8" />
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>Dragg Clipboard</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {items.length > 0 && (
              <button
                onClick={handleClearAll}
                style={{
                  background: 'rgba(18, 18, 24, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#94a3b8',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '3px 9px',
                  borderRadius: '6px',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.4)';
                  e.currentTarget.style.color = '#f43f5e';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#94a3b8';
                }}
                title="Clear all unpinned items"
              >
                Clear all
              </button>
            )}
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
        </div>

        {/* Clipboard Cards List */}
        {sortedItems.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: '#64748b' }}>
            <Clipboard size={26} style={{ marginBottom: '6px', opacity: 0.5, color: '#38bdf8' }} />
            <p style={{ fontSize: '0.84rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Clipboard is empty</p>
            <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Copied elements & nodes will appear here with visual previews.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '440px', overflowY: 'auto', paddingRight: '2px' }}>
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
                    background: isSelected ? 'rgba(30, 41, 59, 0.7)' : 'rgba(18, 18, 24, 0.5)',
                    border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.06)',
                    boxShadow: isSelected ? '0 0 14px rgba(56, 189, 248, 0.25)' : 'none',
                    borderRadius: '10px',
                    padding: '12px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box'
                  }}
                >
                  {/* Top Header Row: Icon + Title + Pin Button + Dedicated Delete Button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'rgba(56, 189, 248, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Layers size={11} color="#38bdf8" />
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title || 'Copied Card(s)'}
                      </span>
                    </div>

                    {/* Action Buttons: Pin & Dedicated Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={(e) => togglePin(item.id, e)}
                        className={`clipboard-action-btn ${isPinned ? 'is-pinned' : ''}`}
                        title={isPinned ? 'Unpin item' : 'Pin item (keep on Clear All)'}
                      >
                        <Pin size={13} color={isPinned ? '#38bdf8' : '#94a3b8'} fill={isPinned ? '#38bdf8' : 'none'} style={{ transform: isPinned ? 'rotate(-45deg)' : 'none', transition: 'transform 0.2s ease' }} />
                      </button>

                      <button
                        onClick={(e) => handleDeleteItem(item.id, e)}
                        className="clipboard-action-btn delete-btn"
                        title="Delete this container"
                      >
                        <Trash2 size={13} color="#94a3b8" />
                      </button>
                    </div>
                  </div>

                  {/* Windows Taskbar Hover Style Visual Preview Box */}
                  <div
                    className="clipboard-preview-box"
                    style={{
                      background: '#090d16',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '4px',
                      marginTop: '2px',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflow: 'hidden'
                    }}
                  >
                    {item.previewImage ? (
                      <img
                        src={item.previewImage}
                        alt="Clipboard Preview"
                        style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '6px' }}
                      />
                    ) : item.cards && item.cards.length > 0 ? (
                      <DraggClipMiniCanvasPreview cards={item.cards} connections={item.connections || []} />
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', padding: '20px 0' }}>No visual preview</div>
                    )}
                  </div>

                  {/* Card Footer: Metadata info & Pinned Tag */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.68rem', color: '#94a3b8' }}>
                    <span>
                      {item.cardCount > 0 ? `${item.cardCount} card${item.cardCount > 1 ? 's' : ''}` : 'Clip item'}
                      {item.connCount > 0 ? ` • ${item.connCount} connection${item.connCount > 1 ? 's' : ''}` : ''}
                    </span>
                    {isPinned && <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.65rem' }}>📌 Pinned</span>}
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
