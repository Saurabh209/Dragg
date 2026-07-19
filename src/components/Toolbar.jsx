import React, { useState, useEffect, useRef } from 'react';
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
  Download,
  Type,
  Check
} from 'lucide-react';

function Toolbar({
  onAddCard,
  onAddHeadingCard,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleGrid,
  gridVisible,
  gridType = 'dots',
  onChangeGridType,
  boardBgColor = '#0a0a0c',
  onChangeBoardBgColor,
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
  const gridMenuRef = useRef(null);
  const [showGridMenu, setShowGridMenu] = useState(false);

  // Auto-close grid selector menu on clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showGridMenu && gridMenuRef.current && !gridMenuRef.current.contains(e.target)) {
        setShowGridMenu(false);
      }
    };

    if (showGridMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGridMenu]);

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
            onClick={onAddHeadingCard} 
            title="Create Heading Node"
            style={{ gap: '0.4rem', padding: '0.5rem 0.8rem', color: 'var(--color-text-main)' }}
          >
            <Type size={16} color="var(--accent-indigo)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Heading</span>
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
          {/* Grid Type Selector Popover */}
          <div ref={gridMenuRef} style={{ position: 'relative' }}>
            <button 
              className={`toolbar-btn ${gridType !== 'none' ? 'active' : ''}`} 
              onClick={() => setShowGridMenu((prev) => !prev)} 
              title="Background Grid Options"
            >
              <Grid size={16} />
            </button>

            {showGridMenu && (
              <div 
                className="grid-popover-menu glass"
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 10px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(20, 20, 30, 0.95)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
                  zIndex: 999,
                  minWidth: '130px'
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Canvas Grid Pattern
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '150px', overflowY: 'auto', marginBottom: '6px' }}>
                  {[
                    { id: 'dots', label: 'Dotted Grid' },
                    { id: 'fine-dots', label: 'Micro Dots' },
                    { id: 'lines', label: 'Graph Lines' },
                    { id: 'major-grid', label: 'Major/Minor Grid' },
                    { id: 'crosses', label: 'Crosshairs' },
                    { id: 'isometric', label: 'Isometric Grid' },
                    { id: 'honeycomb', label: 'Honeycomb (Hex)' },
                    { id: 'blueprint', label: 'Blueprint Blue' },
                    { id: 'ruled', label: 'Ruled Lines' },
                    { id: 'none', label: 'None (Blank)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        if (onChangeGridType) {
                          onChangeGridType(opt.id);
                        } else if (onToggleGrid) {
                          onToggleGrid();
                        }
                      }}
                      style={{
                        background: gridType === opt.id ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                        border: gridType === opt.id ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                        color: gridType === opt.id ? '#a5b4fc' : 'var(--color-text-main)',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontWeight: gridType === opt.id ? 600 : 400,
                        transition: 'all 0.15s'
                      }}
                    >
                      <span>{opt.label}</span>
                      {gridType === opt.id && <Check size={12} style={{ color: '#a5b4fc' }} />}
                    </button>
                  ))}
                </div>

                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '6px' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block' }}>
                    Canvas Background Color
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {[
                      { name: 'Dark Pitch', hex: '#0a0a0c' },
                      { name: 'Deep Slate', hex: '#111827' },
                      { name: 'Midnight Navy', hex: '#0f172a' },
                      { name: 'Deep Emerald', hex: '#062e24' },
                      { name: 'Deep Purple', hex: '#1e1b4b' },
                      { name: 'Blueprint Blue', hex: '#0b172a' },
                    ].map((bg) => (
                      <div
                        key={bg.name}
                        onClick={() => {
                          if (onChangeBoardBgColor) onChangeBoardBgColor(bg.hex);
                        }}
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          backgroundColor: bg.hex,
                          cursor: 'pointer',
                          border: boardBgColor === bg.hex ? '2px solid #a5b4fc' : '1px solid rgba(255, 255, 255, 0.25)',
                          boxShadow: boardBgColor === bg.hex ? '0 0 8px rgba(99, 102, 241, 0.6)' : 'none',
                          transition: 'transform 0.15s'
                        }}
                        title={bg.name}
                      />
                    ))}

                    {/* Custom Canvas Color Input */}
                    <input 
                      type="color"
                      value={boardBgColor || '#0a0a0c'}
                      onChange={(e) => {
                        if (onChangeBoardBgColor) onChangeBoardBgColor(e.target.value);
                      }}
                      style={{
                        width: '20px',
                        height: '20px',
                        padding: 0,
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer'
                      }}
                      title="Pick custom canvas background color"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
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
