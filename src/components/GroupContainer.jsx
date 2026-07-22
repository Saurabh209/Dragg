import React from 'react';
import { Lock, Unlock, X } from 'lucide-react';

function GroupContainer({ 
  group, 
  isSelected, 
  onSelect, 
  onUpdate, 
  zoom, 
  isViewOnly,
  isDimmed = false,
  highlightDelay = 0
}) {
  const dimStyle = isDimmed ? {
    opacity: 0.1,
    filter: 'grayscale(90%) blur(0.5px)',
    pointerEvents: 'none',
    transition: 'opacity 0.8s ease, filter 0.8s ease',
  } : {
    transition: 'opacity 0.8s ease, filter 0.8s ease',
    transitionDelay: highlightDelay ? `${highlightDelay}ms` : '0ms'
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    
    // Don't drag if clicking buttons or input fields
    if (
      e.target.tagName === 'INPUT' || 
      e.target.closest('button') || 
      e.target.closest('.resize-handle-se')
    ) {
      return;
    }

    e.stopPropagation();
    onSelect(group.id, e);

    if (isViewOnly || group.isLocked) return;

    const startX = group.x;
    const startY = group.y;
    const clientStartX = e.clientX;
    const clientStartY = e.clientY;

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - clientStartX;
      const dy = moveEvent.clientY - clientStartY;

      const newX = startX + dx / zoom;
      const newY = startY + dy / zoom;

      onUpdate(group.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleUngroup = (e) => {
    e.stopPropagation();
    if (isViewOnly || group.isLocked) return;
    onUpdate(group.id, { dissolveGroup: true });
  };

  const handleToggleLock = (e) => {
    e.stopPropagation();
    if (isViewOnly) return;
    onUpdate(group.id, { isLocked: !group.isLocked });
  };

  const handleResizeMouseDown = (e) => {
    if (isViewOnly || group.isLocked) return;
    e.preventDefault();
    e.stopPropagation();

    const startWidth = group.width || 400;
    const startHeight = group.height || 300;
    const clientStartX = e.clientX;
    const clientStartY = e.clientY;

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - clientStartX;
      const dy = moveEvent.clientY - clientStartY;

      const newWidth = Math.max(180, startWidth + dx / zoom);
      const newHeight = Math.max(120, startHeight + dy / zoom);

      onUpdate(group.id, { width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const isLocked = isViewOnly || group.isLocked;

  return (
    <div
      className={`group-container-wrapper ${isSelected ? 'selected' : ''} ${group.isLocked ? 'locked' : ''}`}
      style={{
        position: 'absolute',
        transform: `translate(${group.x}px, ${group.y}px)`,
        width: group.width || 400,
        height: group.height || 300,
        zIndex: 5,
        ...dimStyle
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="group-header">
        <input
          type="text"
          value={group.title || ''}
          onChange={(e) => onUpdate(group.id, { title: e.target.value })}
          className="group-title-input"
          placeholder="Unnamed Group"
          disabled={isLocked}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="group-actions">
          {!isViewOnly && (
            <button 
              onClick={handleToggleLock} 
              className="group-action-btn"
              title={group.isLocked ? "Unlock Group Container" : "Lock Group Container"}
            >
              {group.isLocked ? <Lock size={12} color="var(--accent-rose)" /> : <Unlock size={12} />}
            </button>
          )}
          {!isLocked && (
            <button 
              onClick={handleUngroup} 
              className="group-action-btn"
              title="Ungroup / Dissolve Group"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="group-body-frame" />
      
      {/* SE Resize handle */}
      {!isLocked && (
        <div
          className="resize-handle-se"
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            bottom: '0',
            right: '0',
            width: '12px',
            height: '12px',
            cursor: 'se-resize',
            background: 'rgba(6, 182, 212, 0.4)',
            borderTopLeftRadius: '4px',
            borderBottomRightRadius: '11px',
            zIndex: 10
          }}
        />
      )}
    </div>
  );
}

export default GroupContainer;
