import React, { useState, useEffect } from 'react';
import LeftVerticalToolbar from '../shared/LeftVerticalToolbar';
import FreestyleCard from './FreestyleCard';
import FreestyleContextMenu from '../features/context_menu/FreestyleContextMenu';
import CodeStorageCardModal from '../features/modals/CodeStorageCardModal';
import { ArrowLeft } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function FreestyleCanvas({ boardId, onBack, showToast }) {
  const [board, setBoard] = useState(null);
  const [cards, setCards] = useState([]);
  const [toolMode, setToolMode] = useState('select');
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [contextMenuPos, setContextMenuPos] = useState(null);
  const [activeCodeCard, setActiveCodeCard] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [boardBgColor, setBoardBgColor] = useState('#0a0a0c');
  const [liveBgStyle, setLiveBgStyle] = useState('none');
  const [gridType, setGridType] = useState('dots');
  const [cursorStyle, setCursorStyle] = useState('default');
  const [penColor, setPenColor] = useState('#6366f1');
  const [penThickness, setPenThickness] = useState(3);
  const [connectorStyle, setConnectorStyle] = useState('default');

  useEffect(() => {
    fetch(`${API_BASE}/freestyle-boards/${boardId}`)
      .then((res) => {
        if (!res.ok) return fetch(`${API_BASE}/boards/${boardId}`);
        return res;
      })
      .then((res) => res.json())
      .then((data) => {
        setBoard(data);
        setCards(data.cards || []);
        if (data.boardBgColor) setBoardBgColor(data.boardBgColor);
        if (data.liveBgStyle) setLiveBgStyle(data.liveBgStyle);
      })
      .catch((err) => console.error('Failed to load freestyle board', err));
  }, [boardId]);

  const handleAddCard = (type = 'note') => {
    const newCard = {
      id: 'card_' + Date.now(),
      x: 200 - pan.x,
      y: 150 - pan.y,
      width: 280,
      height: 200,
      type,
      title: type === 'code' ? 'Code Snippet' : 'Note',
      content: type === 'code' ? '' : '<p>Start typing...</p>',
      code: ''
    };
    const updated = [...cards, newCard];
    setCards(updated);
    if (showToast) showToast(`Added ${type} card`);
    saveBoardState(updated);
  };

  const handleUpdateCard = (id, fields) => {
    const updated = cards.map((c) => (c.id === id ? { ...c, ...fields } : c));
    setCards(updated);
    saveBoardState(updated);
  };

  const handleDeleteSelected = () => {
    if (!selectedCardId) return;
    const updated = cards.filter((c) => c.id !== selectedCardId);
    setCards(updated);
    setSelectedCardId(null);
    saveBoardState(updated);
  };

  const saveBoardState = (updatedCards) => {
    fetch(`${API_BASE}/freestyle-boards/${boardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: updatedCards, pan, boardBgColor, liveBgStyle })
    }).catch(err => console.error(err));
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: boardBgColor
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }}
      onClick={() => {
        setContextMenuPos(null);
        setSelectedCardId(null);
      }}
    >

      {/* Back to Dashboard Header */}
      <div style={{ position: 'fixed', top: '20px', left: '20px', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onBack}
          className="glass"
          style={{
            padding: '8px 16px',
            borderRadius: '12px',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}
        >
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: '1.1rem' }}>
          {board?.name || 'Freestyle Board'}
        </span>
      </div>

      <LeftVerticalToolbar
        onAddCardDirect={(type) => handleAddCard(type)}
        onAddCardCustom={() => handleAddCard('note')}
        gridType={gridType}
        onChangeGridType={setGridType}
        boardBgColor={boardBgColor}
        onChangeBoardBgColor={(color) => {
          setBoardBgColor(color);
          saveBoardState(cards);
        }}
        liveBgStyle={liveBgStyle}
        onChangeLiveBgStyle={(style) => {
          setLiveBgStyle(style);
          saveBoardState(cards);
        }}
        cursorStyle={cursorStyle}
        onChangeCursorStyle={setCursorStyle}
        toolMode={toolMode}
        onChangeToolMode={setToolMode}
        penColor={penColor}
        onChangePenColor={setPenColor}
        penThickness={penThickness}
        onChangePenThickness={setPenThickness}
        connectorStyle={connectorStyle}
        onChangeConnectorStyle={setConnectorStyle}
      />

      {/* Cards Canvas Container */}
      <div style={{ transform: `translate(${pan.x}px, ${pan.y}px)`, width: '100%', height: '100%' }}>
        {cards.map((card) => (
          <FreestyleCard
            key={card.id}
            card={card}
            isSelected={selectedCardId === card.id}
            onSelect={setSelectedCardId}
            onUpdate={handleUpdateCard}
            onOpenCodeModal={setActiveCodeCard}
          />
        ))}
      </div>

      <FreestyleContextMenu
        position={contextMenuPos}
        onClose={() => setContextMenuPos(null)}
        onAddCard={handleAddCard}
        onDeleteSelected={handleDeleteSelected}
      />

      <CodeStorageCardModal
        isOpen={!!activeCodeCard}
        onClose={() => setActiveCodeCard(null)}
        card={activeCodeCard}
        onSaveCode={(id, data) => {
          handleUpdateCard(id, data);
          setActiveCodeCard(null);
        }}
      />
    </div>
  );
}
