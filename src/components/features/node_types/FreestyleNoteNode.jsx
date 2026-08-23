import React from 'react';
import RichTextEditor from '../../shared/RichTextEditor';

export default function FreestyleNoteNode({ card, onUpdate, isViewOnly }) {
  return (
    <div className="freestyle-note-node" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <RichTextEditor
        content={card.content}
        onUpdate={(newHtml) => onUpdate(card.id, { content: newHtml })}
        isViewOnly={isViewOnly}
      />
    </div>
  );
}
