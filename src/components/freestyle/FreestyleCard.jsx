import React from 'react';
import FreestyleNoteNode from '../features/node_types/FreestyleNoteNode';
import FreestyleCodeNode from '../features/node_types/FreestyleCodeNode';

export default function FreestyleCard({ card, isSelected, onSelect, onUpdate, onOpenCodeModal, isViewOnly }) {
  return (
    <div
      className={`freestyle-card ${isSelected ? 'selected' : ''}`}
      style={{
        position: 'absolute',
        transform: `translate(${card.x}px, ${card.y}px)`,
        width: card.width || 280,
        height: card.height || 200,
        background: card.color || '#181824',
        borderRadius: '16px',
        border: isSelected ? '2px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
        boxShadow: isSelected ? '0 0 20px rgba(99, 102, 241, 0.4)' : '0 8px 24px rgba(0,0,0,0.25)',
        padding: '12px',
        boxSizing: 'border-box',
        zIndex: isSelected ? 20 : 10
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(card.id);
      }}
    >
      {card.type === 'code' ? (
        <FreestyleCodeNode card={card} onOpenModal={onOpenCodeModal} />
      ) : (
        <FreestyleNoteNode card={card} onUpdate={onUpdate} isViewOnly={isViewOnly} />
      )}
    </div>
  );
}
