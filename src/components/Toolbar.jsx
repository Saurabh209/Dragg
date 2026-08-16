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
  Check,
  Pointer,
  Crosshair,
  Target,
  Sparkles,
  CircleDot,
  Pencil,
  Hand,
  BoxSelect
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
  liveBgStyle = 'none',
  onChangeLiveBgStyle,
  cursorStyle = 'default',
  onChangeCursorStyle,
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
  isViewOnly = false,
  showTextFormatBar = false,
  onToggleTextFormatBar,

  // Connection customization props
  connectorStyle = 'default',
  onChangeConnectorStyle,
  connectorColor = 'auto',
  onChangeConnectorColor,
  connectorAnimation = 'none',
  onChangeConnectorAnimation,
  connectorThickness = 2.5,
  onChangeConnectorThickness
}) {
  const fileInputRef = useRef(null);
  const gridMenuRef = useRef(null);
  const cursorMenuRef = useRef(null);
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [showCursorMenu, setShowCursorMenu] = useState(false);
  const [showLinkOptions, setShowLinkOptions] = useState(false);
  const [showPenOptions, setShowPenOptions] = useState(false);
  const [bgTab, setBgTab] = useState('static'); // 'static' | 'live'

  // Auto-close grid & cursor selector menus on clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showGridMenu && gridMenuRef.current && !gridMenuRef.current.contains(e.target)) {
        setShowGridMenu(false);
      }
      if (showCursorMenu && cursorMenuRef.current && !cursorMenuRef.current.contains(e.target)) {
        setShowCursorMenu(false);
      }
    };

    if (showGridMenu || showCursorMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showGridMenu, showCursorMenu]);

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

        {/* Mode Tool Group (V & M modes + Link Options button) */}
        <div className="toolbar-group">
          <button
            className={`toolbar-btn ${toolMode === 'select' ? 'active' : ''}`}
            onClick={() => onChangeToolMode('select')}
            title="Default Pointer Tool (V)"
          >
            <MousePointer size={17} />
          </button>
          <button
            className={`toolbar-btn ${toolMode === 'box-select' ? 'active' : ''}`}
            onClick={() => onChangeToolMode('box-select')}
            title="Multi-Card Marquee Select (M)"
          >
            <BoxSelect size={17} />
          </button>

          {/* Link Button - Toggles Inline Connection Controls */}
          <button
            className={`toolbar-btn ${showLinkOptions ? 'active' : ''}`}
            onClick={() => {
              setShowLinkOptions((prev) => !prev);
              if (showPenOptions) setShowPenOptions(false);
            }}
            title="Toggle Link Style Options"
            style={{ color: showLinkOptions ? 'var(--accent-indigo)' : 'inherit' }}
          >
            <Link size={17} />
          </button>

          {/* Pencil / Pen Button - Toggles Inline Pencil Controls */}
          <button
            className={`toolbar-btn ${toolMode === 'pen' || showPenOptions ? 'active' : ''}`}
            onClick={() => {
              onChangeToolMode('pen');
              setShowPenOptions((prev) => !prev);
              if (showLinkOptions) setShowLinkOptions(false);
            }}
            title="Freehand Pencil Tool (P) / Brush Options"
            style={{ color: toolMode === 'pen' || showPenOptions ? 'var(--accent-cyan)' : 'inherit' }}
          >
            <Pencil size={17} />
          </button>

          {/* Inline Single-Click Connection Options */}
          {showLinkOptions && (
            <div 
              className="toolbar-inline-options"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(15, 23, 42, 0.85)',
                padding: '3px 8px',
                borderRadius: '8px',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                marginLeft: '4px'
              }}
            >
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Style:</span>

              {/* Path Types */}
              {[
                { id: 'default', label: 'Curve' },
                { id: 'waypoints', label: 'Waypoints' },
                { id: 'dotted', label: 'Dotted' },
                { id: 'arrow', label: 'Arrow' },
                { id: 'smooth-90', label: '90°' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeConnectorStyle(opt.id)}
                  style={{
                    background: connectorStyle === opt.id ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
                    color: connectorStyle === opt.id ? '#a5b4fc' : '#cbd5e1',
                    border: connectorStyle === opt.id ? '1px solid #6366f1' : '1px solid transparent',
                    borderRadius: '5px',
                    padding: '2px 7px',
                    fontSize: '0.72rem',
                    fontWeight: connectorStyle === opt.id ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}

              <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

              {/* Flow Effects */}
              {[
                { id: 'none', label: 'Static' },
                { id: 'flow-forward', label: 'Flow ➔' },
                { id: 'pulse', label: 'Pulse ⚡' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeConnectorAnimation(opt.id)}
                  style={{
                    background: connectorAnimation === opt.id ? 'rgba(168, 85, 247, 0.35)' : 'transparent',
                    color: connectorAnimation === opt.id ? '#e9d5ff' : '#cbd5e1',
                    border: connectorAnimation === opt.id ? '1px solid #a855f7' : '1px solid transparent',
                    borderRadius: '5px',
                    padding: '2px 7px',
                    fontSize: '0.72rem',
                    fontWeight: connectorAnimation === opt.id ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}

              <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

              {/* Color Swatches */}
              {[
                { id: 'auto', title: 'Auto (Based on Card)', color: '#38bdf8' },
                { id: '#ffffff', title: 'White', color: '#ffffff' },
                { id: '#6366f1', title: 'Indigo', color: '#6366f1' },
                { id: '#10b981', title: 'Emerald', color: '#10b981' },
                { id: '#ef4444', title: 'Rose', color: '#ef4444' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChangeConnectorColor(c.id)}
                  title={c.title}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: c.color,
                    border: connectorColor === c.id ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.25)',
                    cursor: 'pointer',
                    boxShadow: connectorColor === c.id ? '0 0 6px ' + c.color : 'none',
                    transition: 'all 0.12s ease'
                  }}
                />
              ))}
            </div>
          )}

          {/* Inline Pencil / Brush Drawing Options */}
          {showPenOptions && (
            <div 
              className="toolbar-inline-options"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'rgba(15, 23, 42, 0.85)',
                padding: '3px 8px',
                borderRadius: '8px',
                border: '1px solid rgba(6, 182, 212, 0.35)',
                marginLeft: '4px'
              }}
            >
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Size:</span>

              {/* Size Buttons */}
              {[
                { size: 2, label: 'Thin' },
                { size: 5, label: 'Med' },
                { size: 10, label: 'Thick' },
                { size: 18, label: 'Huge' }
              ].map((opt) => (
                <button
                  key={opt.size}
                  type="button"
                  onClick={() => {
                    onChangePenThickness(opt.size);
                    onChangeToolMode('pen');
                  }}
                  style={{
                    background: penThickness === opt.size ? 'rgba(6, 182, 212, 0.35)' : 'transparent',
                    color: penThickness === opt.size ? '#cffafe' : '#cbd5e1',
                    border: penThickness === opt.size ? '1px solid #06b6d4' : '1px solid transparent',
                    borderRadius: '5px',
                    padding: '2px 7px',
                    fontSize: '0.72rem',
                    fontWeight: penThickness === opt.size ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                >
                  {opt.label}
                </button>
              ))}

              <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Color:</span>

              {/* Pen Colors */}
              {[
                { hex: '#ffffff', title: 'White' },
                { hex: '#f87171', title: 'Red' },
                { hex: '#4ade80', title: 'Green' },
                { hex: '#60a5fa', title: 'Blue' },
                { hex: '#facc15', title: 'Yellow' },
                { hex: '#c084fc', title: 'Purple' }
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => {
                    onChangePenColor(c.hex);
                    onChangeToolMode('pen');
                  }}
                  title={c.title}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: c.hex,
                    border: penColor === c.hex ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.25)',
                    cursor: 'pointer',
                    boxShadow: penColor === c.hex ? '0 0 6px ' + c.hex : 'none',
                    transition: 'all 0.12s ease'
                  }}
                />
              ))}

              <input
                type="color"
                value={penColor || '#ffffff'}
                onChange={(e) => {
                  onChangePenColor(e.target.value);
                  onChangeToolMode('pen');
                }}
                style={{
                  width: '18px',
                  height: '18px',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer'
                }}
                title="Pick custom brush color"
              />
            </div>
          )}
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
            title="Create Minimal Card"
            style={{ gap: '0.4rem', padding: '0.5rem 0.8rem', color: 'var(--color-text-main)' }}
          >
            <Type size={16} color="var(--accent-indigo)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Minimal</span>
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
                    { id: 'lines', label: 'Graph Lines' },
                    { id: 'major-grid', label: 'Major/Minor Grid' },
                    { id: 'blueprint', label: 'Blueprint Blue' },
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
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', background: 'rgba(0, 0, 0, 0.35)', padding: '3px', borderRadius: '7px' }}>
                    <button
                      type="button"
                      onClick={() => setBgTab('static')}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        borderRadius: '5px',
                        border: 'none',
                        background: bgTab === 'static' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                        color: bgTab === 'static' ? '#a5b4fc' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      🎨 Static
                    </button>
                    <button
                      type="button"
                      onClick={() => setBgTab('live')}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        borderRadius: '5px',
                        border: 'none',
                        background: bgTab === 'live' ? 'rgba(168, 85, 247, 0.3)' : 'transparent',
                        color: bgTab === 'live' ? '#e9d5ff' : 'var(--color-text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      ⚡ Live Bg
                    </button>
                  </div>

                  {bgTab === 'static' ? (
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
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '160px', overflowY: 'auto' }}>
                      {[
                        { id: 'interactive-particles', label: '🧲 Interactive Particles' },
                        { id: 'constellation', label: '🕸️ Constellation Mesh' },
                        { id: 'floating-stardust', label: '✨ Floating Stardust' },
                        { id: 'matrix-rain', label: '💻 Matrix Rain Stream' },
                        { id: 'none', label: '🚫 Static Off' },
                      ].map((liveOpt) => (
                        <button
                          key={liveOpt.id}
                          type="button"
                          onClick={() => {
                            if (onChangeLiveBgStyle) onChangeLiveBgStyle(liveOpt.id);
                          }}
                          style={{
                            background: liveBgStyle === liveOpt.id ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            border: liveBgStyle === liveOpt.id ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid transparent',
                            color: liveBgStyle === liveOpt.id ? '#e9d5ff' : 'var(--color-text-main)',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontWeight: liveBgStyle === liveOpt.id ? 600 : 400,
                            transition: 'all 0.15s'
                          }}
                        >
                          <span>{liveOpt.label}</span>
                          {liveBgStyle === liveOpt.id && <Check size={12} style={{ color: '#e9d5ff' }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cursor Style Selector Popover */}
          <div ref={cursorMenuRef} style={{ position: 'relative' }}>
            <button
              className={`toolbar-btn ${cursorStyle !== 'default' ? 'active' : ''}`}
              onClick={() => setShowCursorMenu((prev) => !prev)}
              title="Cursor Style Options"
            >
              <Pointer size={16} />
            </button>

            {showCursorMenu && (
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
                  minWidth: '155px'
                }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Cursor Style
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '190px', overflowY: 'auto' }}>
                  {[
                    { id: 'default', label: 'Default Pointer', Icon: MousePointer },
                    { id: 'crosshair', label: 'Precision Crosshair', Icon: Crosshair },
                    { id: 'laser', label: 'Laser Dot', Icon: CircleDot },
                    { id: 'target', label: 'Cyber Reticle', Icon: Target },
                    { id: 'circle', label: 'Neon Ring', Icon: Pointer },
                    { id: 'wand', label: 'Magic Star', Icon: Sparkles },
                    { id: 'pencil', label: 'Stylus / Pencil', Icon: Pencil },
                    { id: 'grab', label: 'Grab Hand', Icon: Hand },
                  ].map((opt) => {
                    const IconComp = opt.Icon;
                    const isActive = cursorStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => {
                          if (onChangeCursorStyle) onChangeCursorStyle(opt.id);
                          setShowCursorMenu(false);
                        }}
                        style={{
                          background: isActive ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                          border: isActive ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid transparent',
                          color: isActive ? '#a5b4fc' : 'var(--color-text-main)',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontWeight: isActive ? 600 : 400,
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <IconComp size={13} style={{ opacity: isActive ? 1 : 0.7, color: isActive ? '#a5b4fc' : 'inherit' }} />
                          <span>{opt.label}</span>
                        </div>
                        {isActive && <Check size={12} style={{ color: '#a5b4fc' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>



          {/* Text Formatting Toolbar Toggle */}
          <button
            className={`toolbar-btn ${showTextFormatBar ? 'active' : ''}`}
            onClick={onToggleTextFormatBar}
            title={showTextFormatBar ? "Hide Text Formatting Menu" : "Show Text Formatting Menu"}
            style={{
              color: showTextFormatBar ? 'var(--accent-cyan)' : 'inherit',
              border: showTextFormatBar ? '1px solid var(--accent-cyan)' : '1px solid transparent',
              background: showTextFormatBar ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
              borderRadius: '6px'
            }}
          >
            <Type size={16} />
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
