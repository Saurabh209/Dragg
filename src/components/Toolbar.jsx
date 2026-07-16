import React, { useRef } from 'react';
import { 
  Plus, 
  ZoomIn, 
  ZoomOut, 
  Home, 
  Maximize, 
  Grid, 
  Trash2, 
  MousePointer, 
  Link, 
  Eraser,
  Image, 
  Download 
} from 'lucide-react';

function Toolbar({
  onAddCard,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleGrid,
  gridVisible,
  onClearBoard,
  onBack,
  zoom,
  toolMode, // 'select' | 'connector' | 'pen' | 'ruler'
  onChangeToolMode,
  onUploadImage, // (base64)
  onExportPNG,
  penColor,
  onChangePenColor,
  penThickness,
  onChangePenThickness,
  isViewOnly = false
}) {
  const fileInputRef = useRef(null);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      onUploadImage(event.target.result);
    };
    reader.readAsDataURL(file);
    // Reset file input value to allow selecting the same file again
    e.target.value = '';
  };

  return (
    <>


      {/* Main Bottom Toolbar */}
      <div 
        className={`toolbar-container glass-toolbar ${isViewOnly ? 'view-only-locked' : ''}`}
        title={isViewOnly ? 'Whiteboard is locked' : ''}
        style={isViewOnly ? {
          background: 'rgba(40, 40, 45, 0.65)',
          borderColor: 'rgba(255, 255, 255, 0.05)',
          filter: 'grayscale(1)',
          opacity: 0.4
        } : {}}
      >
        {/* Navigation Group */}
        <div className="toolbar-group">
          <button 
            className="toolbar-btn" 
            onClick={onBack} 
            title="Back to Dashboard"
          >
            <Home size={18} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Mode Tool Group */}
        <div className="toolbar-group">
          <button 
            className={`toolbar-btn ${toolMode === 'select' ? 'active' : ''}`}
            onClick={() => onChangeToolMode('select')}
            title="Select & Move (V)"
          >
            <MousePointer size={17} />
          </button>
          <button 
            className={`toolbar-btn ${toolMode === 'connector' ? 'active' : ''}`}
            onClick={() => onChangeToolMode('connector')}
            title="Connect Cards Tool (C)"
          >
            <Link size={17} />
          </button>
          <button 
            className={`toolbar-btn ${toolMode === 'eraser' ? 'active' : ''}`}
            onClick={() => onChangeToolMode('eraser')}
            title="Stroke Eraser (E)"
          >
            <Eraser size={17} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Creation Group */}
        <div className="toolbar-group">
          <button 
            className="toolbar-btn" 
            onClick={onAddCard} 
            title="Create Card"
            style={{ gap: '0.4rem', padding: '0.5rem 0.8rem', color: 'var(--color-text-main)' }}
          >
            <Plus size={18} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Card</span>
          </button>

          <button 
            className="toolbar-btn" 
            onClick={handleImageClick} 
            title="Upload Image Card"
          >
            <Image size={17} color="var(--accent-emerald)" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*" 
            onChange={handleFileChange}
          />
        </div>

        <div className="toolbar-divider" />

        {/* Viewport Control Group */}
        <div className="toolbar-group">
          <button 
            className="toolbar-btn" 
            onClick={onZoomOut} 
            title="Zoom Out"
          >
            <ZoomOut size={17} />
          </button>
          <span className="zoom-indicator">
            {Math.round(zoom * 100)}%
          </span>
          <button 
            className="toolbar-btn" 
            onClick={onZoomIn} 
            title="Zoom In"
          >
            <ZoomIn size={17} />
          </button>
          <button 
            className="toolbar-btn" 
            onClick={onResetZoom} 
            title="Recenter Canvas"
          >
            <Maximize size={16} />
          </button>
          <button 
            className={`toolbar-btn ${gridVisible ? 'active' : ''}`} 
            onClick={onToggleGrid} 
            title="Toggle Grid"
          >
            <Grid size={16} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Actions Group */}
        <div className="toolbar-group">
          <button 
            className="toolbar-btn" 
            onClick={onExportPNG} 
            title="Export Board to PNG Image"
          >
            <Download size={17} color="var(--accent-amber)" />
          </button>
          <button 
            className="toolbar-btn" 
            onClick={onClearBoard} 
            title="Clear Board Canvas"
          >
            <Trash2 size={16} style={{ color: 'var(--accent-rose)' }} />
          </button>
        </div>
      </div>
    </>
  );
}

export default Toolbar;
