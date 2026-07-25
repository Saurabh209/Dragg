import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  MousePointer,
  Link as LinkIcon,
  Pencil,
  Eraser,
  Type,
  Image as ImageIcon,
  Grid,
  Settings,
  BoxSelect,
  Check,
  Code2,
  Trash2,
  Download,
  Pointer,
  Sparkles,
  CircleDot,
  Crosshair,
  Hand,
  Target,
  Maximize,
  GripVertical,
  GripHorizontal,
  Zap
} from 'lucide-react';

function LeftVerticalToolbar({
  onAddCardDirect,
  onAddCardCustom,
  gridType = 'dots',
  onChangeGridType,
  boardBgColor = '#0a0a0c',
  onChangeBoardBgColor,
  liveBgStyle = 'none',
  onChangeLiveBgStyle,
  cursorStyle = 'default',
  onChangeCursorStyle,
  onClearBoard,
  onResetZoom,
  toolMode, // 'select' | 'connector' | 'pen' | 'ruler' | 'box-select' | 'eraser'
  onChangeToolMode,
  onExportPNG,
  penColor,
  onChangePenColor,
  penThickness,
  onChangePenThickness,
  isViewOnly = false,
  connectorStyle = 'default',
  onChangeConnectorStyle,
  connectorColor = 'auto',
  onChangeConnectorColor,
  connectorAnimation = 'none',
  onChangeConnectorAnimation,
  connectorThickness = 2.5,
  onChangeConnectorThickness,
  
  // Draggable toolbar positioning props
  toolbarSettings = { position: { x: 20, y: 200 }, orientation: 'vertical' },
  onChangeToolbarSettings,

  // Custom keymapping presets props
  stylePresets = [],
  onChangeStylePresets
}) {
  const [activeMenu, setActiveMenu] = useState(null); // null | 'node' | 'connector' | 'pen' | 'settings'
  const [activeSettingsSubmenu, setActiveSettingsSubmenu] = useState(null); // null | 'grid' | 'background' | 'cursor' | 'actions'
  const [activeConnectorSubmenu, setActiveConnectorSubmenu] = useState(null); // null | 'style' | 'flow' | 'weight' | 'color'
  const [activeMacroSubmenu, setActiveMacroSubmenu] = useState(null); // null | 'create'
  const [bgTab, setBgTab] = useState('static'); // 'static' | 'live'
  const [dragState, setDragState] = useState(null); // null | { startX, startY, initialX, initialY }

  useEffect(() => {
    if (activeMenu !== 'settings') {
      setActiveSettingsSubmenu(null);
    }
  }, [activeMenu]);

  useEffect(() => {
    if (activeMenu !== 'connector') {
      setActiveConnectorSubmenu(null);
    }
  }, [activeMenu]);

  useEffect(() => {
    if (activeMenu !== 'macro') {
      setActiveMacroSubmenu(null);
    }
  }, [activeMenu]);
  
  // Local states for dragging coordinates and orientation layout
  const [localPos, setLocalPos] = useState(toolbarSettings.position || { x: 20, y: 200 });
  const [localOrientation, setLocalOrientation] = useState(toolbarSettings.orientation || 'vertical');
  const latestPosRef = useRef({ 
    position: toolbarSettings.position || { x: 20, y: 200 }, 
    orientation: toolbarSettings.orientation || 'vertical' 
  });

  useEffect(() => {
    if (!dragState) {
      const pos = toolbarSettings.position || { x: 20, y: 200 };
      const orient = toolbarSettings.orientation || 'vertical';
      setLocalPos(pos);
      setLocalOrientation(orient);
      latestPosRef.current = { position: pos, orientation: orient };
    }
  }, [toolbarSettings, dragState]);

  const toolbarRef = useRef(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleMenu = (menuName) => {
    setActiveMenu((prev) => (prev === menuName ? null : menuName));
  };

  // Reposition logic on dragging drag handle
  const handleMouseDown = (e) => {
    if (isViewOnly) return;
    if (e.button !== 0) return; // Left click drag only
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = localPos.x;
    const initialY = localPos.y;

    setDragState({ startX, startY, initialX, initialY });
  };

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;

      let newX = dragState.initialX + dx;
      let newY = dragState.initialY + dy;

      // Clamp dimensions based on current orientation layout
      const isHoriz = localOrientation === 'horizontal';
      const toolbarW = isHoriz ? 450 : 60;
      const toolbarH = isHoriz ? 60 : 450;

      newX = Math.max(10, Math.min(window.innerWidth - toolbarW - 10, newX));
      newY = Math.max(10, Math.min(window.innerHeight - toolbarH - 10, newY));

      // Calculate orientation based on closest screen edge relative to current CURSOR positions clientX/Y
      const distL = e.clientX;
      const distR = window.innerWidth - e.clientX;
      const distT = e.clientY;
      const distB = window.innerHeight - e.clientY;

      const minDist = Math.min(distL, distR, distT, distB);
      let orientation = 'vertical';
      if (minDist === distT || minDist === distB) {
        orientation = 'horizontal';
      } else {
        orientation = 'vertical';
      }

      setLocalPos({ x: newX, y: newY });
      setLocalOrientation(orientation);
      latestPosRef.current = { position: { x: newX, y: newY }, orientation };
    };

    const handleMouseUp = () => {
      setDragState(null);
      if (onChangeToolbarSettings) {
        onChangeToolbarSettings(latestPosRef.current);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, localOrientation, onChangeToolbarSettings]);

  const isHorizontal = true; // Fixed horizontal layout
  const isMenuLeft = false; // Keep menus centered / opening rightwards

  return (
    <div
      ref={toolbarRef}
      className={`vertical-toolbar-container horizontal ${isViewOnly ? 'view-only-locked' : ''}`}
      title={isViewOnly ? 'Whiteboard is locked' : ''}
      style={{
        left: '50%',
        bottom: '1.5rem',
        top: 'auto',
        transform: 'translateX(-50%)',
        position: 'fixed'
      }}
      onWheel={(e) => {
        // Prevent canvas zooming when scrolling inside toolbar lists
        e.stopPropagation();
      }}
    >
      {/* 1. SELECT MODE */}
      <div style={{ position: 'relative' }}>
        <button
          className={`vertical-toolbar-btn ${toolMode === 'select' ? 'active' : ''}`}
          onClick={() => {
            onChangeToolMode('select');
            setActiveMenu(null);
          }}
          title="Select & Pan Tool (V)"
        >
          <Hand size={18} />
          <span className="toolbar-btn-shortcut-badge">V</span>
        </button>
      </div>

      {/* 2. MARQUEE MULTI-SELECT */}
      <div style={{ position: 'relative' }}>
        <button
          className={`vertical-toolbar-btn ${toolMode === 'box-select' ? 'active' : ''}`}
          onClick={() => {
            onChangeToolMode('box-select');
            setActiveMenu(null);
          }}
          title="Multi-Card Marquee Select (M)"
        >
          <BoxSelect size={18} />
          <span className="toolbar-btn-shortcut-badge">M</span>
        </button>
      </div>

      <div className={`vertical-toolbar-divider ${isHorizontal ? 'horizontal' : ''}`} />

      {/* 3. ADD NODE / CARDS */}
      <div style={{ position: 'relative' }}>
        <button
          className={`vertical-toolbar-btn ${activeMenu === 'node' ? 'active' : ''}`}
          onClick={() => toggleMenu('node')}
          title="Add Canvas Card / Node..."
        >
          <Plus size={19} style={{ color: 'var(--accent-cyan)' }} />
        </button>

        {activeMenu === 'node' && (
          <div className={`toolbar-submenu ${isHorizontal ? 'horizontal' : ''} ${isMenuLeft ? 'left-aligned-menu' : ''}`}>
            <div className="submenu-title">Create Node</div>
            <button
              className="submenu-btn"
              onClick={() => {
                onAddCardDirect('notes');
                setActiveMenu(null);
              }}
            >
              📝 Standard Text Card
            </button>
            <button
              className="submenu-btn"
              onClick={() => {
                onAddCardDirect('code');
                setActiveMenu(null);
              }}
            >
              💻 Code Sandbox Card
            </button>
            <button
              className="submenu-btn"
              onClick={() => {
                onAddCardDirect('sketch');
                setActiveMenu(null);
              }}
            >
              🎨 Drawing Sketch Card
            </button>
            <button
              className="submenu-btn"
              onClick={() => {
                onAddCardDirect('image');
                setActiveMenu(null);
              }}
            >
              🖼️ Upload Image Card
            </button>
            <button
              className="submenu-btn"
              onClick={() => {
                onAddCardDirect('minimal');
                setActiveMenu(null);
              }}
            >
              🔤 Minimal Title Node
            </button>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.2rem 0' }} />
            <button
              className="submenu-btn"
              onClick={() => {
                onAddCardCustom();
                setActiveMenu(null);
              }}
              style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}
            >
              🛠️ Configure Custom Card...
            </button>
          </div>
        )}
      </div>

      {/* 4. CONNECTOR MODE ("live node path") */}
      <div style={{ position: 'relative' }}>
        <button
          className={`vertical-toolbar-btn ${toolMode === 'connector' || activeMenu === 'connector' ? 'active' : ''}`}
          onClick={() => {
            onChangeToolMode('connector');
            toggleMenu('connector');
          }}
          title="Connection Mode (C) / Style settings"
        >
          <LinkIcon size={18} style={{ color: 'var(--accent-indigo)' }} />
          <span className="toolbar-btn-shortcut-badge">C</span>
        </button>

        {activeMenu === 'connector' && (
          <div 
            className={`toolbar-submenu connector-menu ${isHorizontal ? 'horizontal' : ''} ${isMenuLeft ? 'left-aligned-menu' : ''}`} 
            style={{ minWidth: '170px' }}
          >
            <div className="submenu-title">Path Settings</div>

            <button
              className={`submenu-btn ${activeConnectorSubmenu === 'style' ? 'active' : ''}`}
              onClick={() => setActiveConnectorSubmenu(activeConnectorSubmenu === 'style' ? null : 'style')}
              style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}
            >
              <span>📐 Path Style</span>
              <span>{isMenuLeft ? '◂' : '▸'}</span>
            </button>

            <button
              className={`submenu-btn ${activeConnectorSubmenu === 'flow' ? 'active' : ''}`}
              onClick={() => setActiveConnectorSubmenu(activeConnectorSubmenu === 'flow' ? null : 'flow')}
              style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}
            >
              <span>⚡ Flow Effects</span>
              <span>{isMenuLeft ? '◂' : '▸'}</span>
            </button>

            <button
              className={`submenu-btn ${activeConnectorSubmenu === 'weight' ? 'active' : ''}`}
              onClick={() => setActiveConnectorSubmenu(activeConnectorSubmenu === 'weight' ? null : 'weight')}
              style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}
            >
              <span>⚖️ Line Weight</span>
              <span>{isMenuLeft ? '◂' : '▸'}</span>
            </button>

            <button
              className={`submenu-btn ${activeConnectorSubmenu === 'color' ? 'active' : ''}`}
              onClick={() => setActiveConnectorSubmenu(activeConnectorSubmenu === 'color' ? null : 'color')}
              style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}
            >
              <span>🎨 Color Preset</span>
              <span>{isMenuLeft ? '◂' : '▸'}</span>
            </button>

            {/* Nested Secondary Connector Menu */}
            {activeConnectorSubmenu && (
              <div 
                className={`toolbar-submenu-secondary ${isMenuLeft ? 'left' : 'right'}`}
              >
                {activeConnectorSubmenu === 'style' && (
                  <>
                    <div className="submenu-title">Path Style</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }}>
                      {[
                        { id: 'default', label: 'Curve' },
                        { id: 'dotted', label: 'Dotted' },
                        { id: 'arrow', label: 'Arrow' },
                        { id: 'smooth-90', label: 'Smooth 90°', beta: true }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          className={`submenu-btn ${connectorStyle === opt.id ? 'active' : ''}`}
                          onClick={() => onChangeConnectorStyle(opt.id)}
                          style={{ padding: '0.35rem 0.45rem', justifyContent: 'center', gap: '3px' }}
                        >
                          <span>{opt.label}</span>
                          {opt.beta && (
                            <span style={{ fontSize: '7px', opacity: 0.8, color: 'var(--accent-amber)', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', padding: '1px 3px', borderRadius: '3px', fontWeight: 800 }}>BETA</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {activeConnectorSubmenu === 'flow' && (
                  <>
                    <div className="submenu-title">Flow Effects</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {[
                        { id: 'none', label: '🚫 Static (None)' },
                        { id: 'flow-forward', label: '➔ Forward Flow' },
                        { id: 'flow-backward', label: '⬅️ Backward Flow' },
                        { id: 'pulse', label: '🔆 Pulse Glow' }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          className={`submenu-btn ${connectorAnimation === opt.id ? 'active' : ''}`}
                          onClick={() => onChangeConnectorAnimation(opt.id)}
                        >
                          <span>{opt.label}</span>
                          {connectorAnimation === opt.id && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {activeConnectorSubmenu === 'weight' && (
                  <>
                    <div className="submenu-title">Line Weight</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[
                        { id: 1.5, label: 'Thin' },
                        { id: 2.5, label: 'Med' },
                        { id: 4.5, label: 'Thick' }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          className={`submenu-btn ${connectorThickness === opt.id ? 'active' : ''}`}
                          onClick={() => onChangeConnectorThickness(opt.id)}
                          style={{ flex: 1, padding: '0.35rem 0', justifyContent: 'center' }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {activeConnectorSubmenu === 'color' && (
                  <>
                    <div className="submenu-title">Connector Color</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {[
                        { id: 'auto', label: 'Auto', color: '#6366f1' },
                        { id: '#f87171', label: 'Red', color: '#f87171' },
                        { id: '#4ade80', label: 'Green', color: '#4ade80' },
                        { id: '#60a5fa', label: 'Blue', color: '#60a5fa' },
                        { id: '#facc15', label: 'Yellow', color: '#facc15' },
                        { id: '#c084fc', label: 'Purple', color: '#c084fc' }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => onChangeConnectorColor(opt.id)}
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: opt.color,
                            border: connectorColor === opt.id ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
                            boxShadow: connectorColor === opt.id ? '0 0 6px ' + opt.color : 'none',
                            cursor: 'pointer',
                            padding: 0
                          }}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. DRAWING PEN MODE */}
      <div style={{ position: 'relative' }}>
        <button
          className={`vertical-toolbar-btn ${toolMode === 'pen' || activeMenu === 'pen' ? 'active' : ''}`}
          onClick={() => {
            onChangeToolMode('pen');
            toggleMenu('pen');
          }}
          title="Freehand Pencil Tool (P) / Brush settings"
        >
          <Pencil size={18} />
          <span className="toolbar-btn-shortcut-badge">P</span>
        </button>

        {activeMenu === 'pen' && (
          <div className={`toolbar-submenu ${isHorizontal ? 'horizontal' : ''} ${isMenuLeft ? 'left-aligned-menu' : ''}`} style={{ minWidth: '170px' }}>
            <div className="submenu-title">Pen Settings</div>

            {/* BRUSH COLOR */}
            <div className="submenu-section-title">Brush Color</div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', padding: '0.2rem 0' }}>
              {[
                { hex: '#ffffff', label: 'White' },
                { hex: '#f87171', label: 'Red' },
                { hex: '#4ade80', label: 'Green' },
                { hex: '#60a5fa', label: 'Blue' },
                { hex: '#facc15', label: 'Yellow' },
                { hex: '#c084fc', label: 'Purple' }
              ].map((col) => (
                <button
                  key={col.hex}
                  onClick={() => onChangePenColor(col.hex)}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    backgroundColor: col.hex,
                    border: penColor === col.hex ? '2px solid var(--accent-indigo)' : '1px solid rgba(255,255,255,0.25)',
                    boxShadow: penColor === col.hex ? '0 0 8px var(--accent-indigo)' : 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  title={col.label}
                />
              ))}
              <input
                type="color"
                value={penColor || '#ffffff'}
                onChange={(e) => onChangePenColor(e.target.value)}
                style={{
                  width: '20px',
                  height: '20px',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer'
                }}
                title="Pick custom brush color"
              />
            </div>

            {/* BRUSH THICKNESS */}
            <div className="submenu-section-title">Brush Size</div>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[
                { size: 2, label: 'Thin' },
                { size: 5, label: 'Med' },
                { size: 10, label: 'Thick' },
                { size: 18, label: 'Huge' }
              ].map((opt) => (
                <button
                  key={opt.size}
                  className={`submenu-btn ${penThickness === opt.size ? 'active' : ''}`}
                  onClick={() => onChangePenThickness(opt.size)}
                  style={{ flex: 1, padding: '0.35rem 0', justifyContent: 'center', fontSize: '0.68rem' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 6. ERASER */}
      <div style={{ position: 'relative' }}>
        <button
          className={`vertical-toolbar-btn ${toolMode === 'eraser' ? 'active' : ''}`}
          onClick={() => {
            onChangeToolMode('eraser');
            setActiveMenu(null);
          }}
          title="Drawing Eraser Tool (E)"
        >
          <Eraser size={18} />
          <span className="toolbar-btn-shortcut-badge">E</span>
        </button>
      </div>

      <div className={`vertical-toolbar-divider ${isHorizontal ? 'horizontal' : ''}`} />

      {/* 7. SETTINGS & BOARD CUSTOMIZATIONS */}
      <div style={{ position: 'relative' }}>
        <button
          className={`vertical-toolbar-btn ${activeMenu === 'settings' ? 'active' : ''}`}
          onClick={() => toggleMenu('settings')}
          title="Board Canvas Configurations & Settings"
        >
          <Settings size={18} />
        </button>

        {activeMenu === 'settings' && (
          <div 
            className={`toolbar-submenu settings-menu ${isHorizontal ? 'horizontal' : ''} ${isMenuLeft ? 'left-aligned-menu' : ''}`} 
            style={{ minWidth: '170px' }}
          >
            <div className="submenu-title">Board Settings</div>
            
            <button
              className={`submenu-btn ${activeSettingsSubmenu === 'grid' ? 'active' : ''}`}
              onClick={() => setActiveSettingsSubmenu(activeSettingsSubmenu === 'grid' ? null : 'grid')}
              style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}
            >
              <span>🌐 Grid Style</span>
              <span>{isMenuLeft ? '◂' : '▸'}</span>
            </button>

            <button
              className={`submenu-btn ${activeSettingsSubmenu === 'background' ? 'active' : ''}`}
              onClick={() => setActiveSettingsSubmenu(activeSettingsSubmenu === 'background' ? null : 'background')}
              style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}
            >
              <span>🎨 Background</span>
              <span>{isMenuLeft ? '◂' : '▸'}</span>
            </button>

            <button
              className={`submenu-btn ${activeSettingsSubmenu === 'cursor' ? 'active' : ''}`}
              onClick={() => {
                if (toolMode !== 'pen' && toolMode !== 'eraser') {
                  setActiveSettingsSubmenu(activeSettingsSubmenu === 'cursor' ? null : 'cursor');
                }
              }}
              style={{ 
                justifyContent: 'space-between', 
                display: 'flex', 
                width: '100%',
                opacity: (toolMode === 'pen' || toolMode === 'eraser') ? 0.45 : 1,
                cursor: (toolMode === 'pen' || toolMode === 'eraser') ? 'not-allowed' : 'pointer'
              }}
              title={(toolMode === 'pen' || toolMode === 'eraser') ? 'Cursor style customization is disabled in drawing modes' : 'Custom Cursor Styles'}
            >
              <span>🎯 Cursor Style</span>
              {(toolMode === 'pen' || toolMode === 'eraser') ? (
                <span style={{ fontSize: '8px', color: 'var(--accent-amber)', fontWeight: 600 }}>Drawing Mode</span>
              ) : (
                <span>{isMenuLeft ? '◂' : '▸'}</span>
              )}
            </button>

            <button
              className={`submenu-btn ${activeSettingsSubmenu === 'actions' ? 'active' : ''}`}
              onClick={() => setActiveSettingsSubmenu(activeSettingsSubmenu === 'actions' ? null : 'actions')}
              style={{ justifyContent: 'space-between', display: 'flex', width: '100%' }}
            >
              <span>🛠️ Actions</span>
              <span>{isMenuLeft ? '◂' : '▸'}</span>
            </button>

            {/* Nested Secondary Settings Menu */}
            {activeSettingsSubmenu && (
              <div 
                className={`toolbar-submenu-secondary ${isMenuLeft ? 'left' : 'right'}`}
              >
                {activeSettingsSubmenu === 'grid' && (
                  <>
                    <div className="submenu-title">Grid Style</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {[
                        { id: 'dots', label: 'Dotted Grid' },
                        { id: 'lines', label: 'Graph Lines' },
                        { id: 'major-grid', label: 'Major Grid' },
                        { id: 'blueprint', label: 'Blueprint Blue' },
                        { id: 'none', label: 'None (Blank)' }
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          className={`submenu-btn ${gridType === opt.id ? 'active' : ''}`}
                          onClick={() => onChangeGridType(opt.id)}
                          style={{ padding: '0.35rem 0.5rem' }}
                        >
                          <span>{opt.label}</span>
                          {gridType === opt.id && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {activeSettingsSubmenu === 'background' && (
                  <>
                    <div className="submenu-title">Background</div>
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '8px', marginBottom: '4px' }}>
                      <button
                        type="button"
                        className={`submenu-btn ${bgTab === 'static' ? 'active' : ''}`}
                        onClick={() => setBgTab('static')}
                        style={{ flex: 1, padding: '0.25rem 0', justifyContent: 'center', fontSize: '0.68rem', borderRadius: '6px' }}
                      >
                        🎨 Static
                      </button>
                      <button
                        type="button"
                        className={`submenu-btn ${bgTab === 'live' ? 'active' : ''}`}
                        onClick={() => setBgTab('live')}
                        style={{ flex: 1, padding: '0.25rem 0', justifyContent: 'center', fontSize: '0.68rem', borderRadius: '6px' }}
                      >
                        ⚡ Live Bg
                      </button>
                    </div>

                    {bgTab === 'static' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', padding: '0.2rem 0' }}>
                        {[
                          { name: 'Dark Pitch', hex: '#0a0a0c' },
                          { name: 'Deep Slate', hex: '#111827' },
                          { name: 'Midnight Navy', hex: '#0f172a' },
                          { name: 'Deep Emerald', hex: '#062e24' },
                          { name: 'Deep Purple', hex: '#1e1b4b' },
                          { name: 'Blueprint Blue', hex: '#0b172a' }
                        ].map((bg) => (
                          <button
                            key={bg.name}
                            onClick={() => onChangeBoardBgColor(bg.hex)}
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: bg.hex,
                              border: boardBgColor === bg.hex ? '2px solid #a5b4fc' : '1px solid rgba(255,255,255,0.2)',
                              boxShadow: boardBgColor === bg.hex ? '0 0 6px rgba(99,102,241,0.6)' : 'none',
                              cursor: 'pointer',
                              padding: 0
                            }}
                            title={bg.name}
                          />
                        ))}
                        <input
                          type="color"
                          value={boardBgColor || '#0a0a0c'}
                          onChange={(e) => onChangeBoardBgColor(e.target.value)}
                          style={{
                            width: '20px',
                            height: '20px',
                            padding: 0,
                            border: 'none',
                            background: 'none',
                            cursor: 'pointer'
                          }}
                          title="Pick custom static background"
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {[
                          { id: 'interactive-particles', label: '🧲 Particles' },
                          { id: 'constellation', label: '🕸️ Constellation' },
                          { id: 'floating-stardust', label: '✨ Stardust' },
                          { id: 'matrix-rain', label: '💻 Matrix Rain' },
                          { id: 'none', label: '🚫 Static Off' }
                        ].map((liveOpt) => (
                          <button
                            key={liveOpt.id}
                            className={`submenu-btn ${liveBgStyle === liveOpt.id ? 'active' : ''}`}
                            onClick={() => onChangeLiveBgStyle(liveOpt.id)}
                            style={{ padding: '0.35rem 0.5rem' }}
                          >
                            <span>{liveOpt.label}</span>
                            {liveBgStyle === liveOpt.id && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeSettingsSubmenu === 'cursor' && (
                  <>
                    <div className="submenu-title">Cursor Style</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {[
                        { id: 'default', label: 'Default Pointer' },
                        { id: 'crosshair', label: 'Precision Crosshair' },
                        { id: 'laser', label: 'Laser Dot' },
                        { id: 'target', label: 'Cyber Reticle' },
                        { id: 'circle', label: 'Neon Ring' },
                        { id: 'wand', label: 'Magic Star' },
                        { id: 'pencil', label: 'Stylus Pencil' },
                        { id: 'grab', label: 'Grab Hand' }
                      ].map((opt) => {
                        const isActive = cursorStyle === opt.id;
                        return (
                          <button
                            key={opt.id}
                            className={`submenu-btn ${isActive ? 'active' : ''}`}
                            onClick={() => onChangeCursorStyle(opt.id)}
                            style={{ padding: '0.35rem 0.5rem' }}
                          >
                            <span>{opt.label}</span>
                            {isActive && <Check size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {activeSettingsSubmenu === 'actions' && (
                  <>
                    <div className="submenu-title">Canvas Actions</div>
                    <button
                      className="submenu-btn"
                      onClick={() => {
                        onResetZoom();
                        setActiveMenu(null);
                      }}
                      style={{ color: 'var(--color-text-main)' }}
                    >
                      🔍 Recenter Viewport
                    </button>
                    <button
                      className="submenu-btn"
                      onClick={() => {
                        onExportPNG();
                        setActiveMenu(null);
                      }}
                      style={{ color: 'var(--color-text-main)' }}
                    >
                      📥 Export as PNG
                    </button>
                    <button
                      className="submenu-btn"
                      onClick={() => {
                        onClearBoard();
                        setActiveMenu(null);
                      }}
                      style={{ color: 'var(--accent-red)' }}
                    >
                      🗑️ Clear Board
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`vertical-toolbar-divider ${isHorizontal ? 'horizontal' : ''}`} />

      {/* 8. PRESETS / QUICK KEYMAPS */}
      <div style={{ position: 'relative' }}>
        <button
          className={`vertical-toolbar-btn ${activeMenu === 'macro' ? 'active' : ''}`}
          onClick={() => toggleMenu('macro')}
          title="Custom Keyboard presets & Quick Style Macros"
        >
          <Zap size={18} style={{ color: 'var(--accent-amber)' }} />
          <span className="toolbar-btn-beta-badge">BETA</span>
        </button>

        {activeMenu === 'macro' && (
          <div 
            className={`toolbar-submenu macro-menu ${isHorizontal ? 'horizontal' : ''} ${isMenuLeft ? 'left-aligned-menu' : ''}`} 
            style={{ minWidth: '190px' }}
          >
            <div className="submenu-title">Quick Style Presets</div>
            
            {stylePresets.length === 0 ? (
              <div style={{ padding: '0.4rem 0.5rem', color: 'var(--color-text-muted)', fontSize: '0.72rem', textAlign: 'center' }}>
                No custom presets defined. Press a key to trigger when defined.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '180px', overflowY: 'auto' }}>
                {stylePresets.map((preset) => (
                  <div 
                    key={preset.id} 
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', width: '100%' }}
                  >
                    <button
                      className="submenu-btn"
                      onClick={() => {
                        // Apply preset directly
                        if (preset.toolMode) onChangeToolMode(preset.toolMode);
                        if (preset.connectorStyle) onChangeConnectorStyle(preset.connectorStyle);
                        if (preset.connectorAnimation) onChangeConnectorAnimation(preset.connectorAnimation);
                        if (preset.connectorColor) onChangeConnectorColor(preset.connectorColor);
                        if (preset.connectorThickness) onChangeConnectorThickness(preset.connectorThickness);
                        if (preset.penColor) onChangePenColor(preset.penColor);
                        if (preset.penThickness) onChangePenThickness(preset.penThickness);
                        if (preset.gridType && onChangeGridType) onChangeGridType(preset.gridType);
                        if (preset.boardBgColor && onChangeBoardBgColor) onChangeBoardBgColor(preset.boardBgColor);
                        if (preset.liveBgStyle && onChangeLiveBgStyle) onChangeLiveBgStyle(preset.liveBgStyle);
                        if (preset.cursorStyle && onChangeCursorStyle) onChangeCursorStyle(preset.cursorStyle);
                        setActiveMenu(null);
                      }}
                      style={{ flex: 1, padding: '0.35rem 0.5rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', gap: '6px' }}
                      title={`Press '${preset.key.toUpperCase()}' to activate`}
                    >
                      <span style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold', color: 'var(--accent-amber)' }}>
                        {preset.key.toUpperCase()}
                      </span>
                      <span>{preset.name}</span>
                    </button>
                    <button
                      className="submenu-btn"
                      onClick={() => {
                        // Delete preset
                        const updated = stylePresets.filter(p => p.id !== preset.id);
                        onChangeStylePresets(updated);
                      }}
                      style={{ padding: '0.35rem', color: 'var(--accent-rose)', width: 'auto' }}
                      title="Delete Preset"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0.3rem 0' }} />

            <button
              className={`submenu-btn ${activeMacroSubmenu === 'create' ? 'active' : ''}`}
              onClick={() => setActiveMacroSubmenu(activeMacroSubmenu === 'create' ? null : 'create')}
              style={{ justifyContent: 'space-between', display: 'flex', width: '100%', color: 'var(--accent-indigo)' }}
            >
              <span>➕ Add Keymap Preset</span>
              <span>{isMenuLeft ? '◂' : '▸'}</span>
            </button>

            {/* Creation Form Submenu */}
            {activeMacroSubmenu === 'create' && (
              <div 
                className={`toolbar-submenu-secondary ${isMenuLeft ? 'left' : 'right'}`}
                style={{ minWidth: '210px' }}
              >
                <div className="submenu-title">Create Preset</div>
                <MacroCreationForm 
                  onSave={(newPreset) => {
                    const updated = [...stylePresets, newPreset];
                    onChangeStylePresets(updated);
                    setActiveMacroSubmenu(null);
                  }}
                  onCancel={() => setActiveMacroSubmenu(null)}
                  toolMode={toolMode}
                  connectorStyle={connectorStyle}
                  connectorAnimation={connectorAnimation}
                  connectorColor={connectorColor}
                  connectorThickness={connectorThickness}
                  penColor={penColor}
                  penThickness={penThickness}
                  gridType={gridType}
                  boardBgColor={boardBgColor}
                  liveBgStyle={liveBgStyle}
                  cursorStyle={cursorStyle}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MacroCreationForm({
  onSave,
  onCancel,
  toolMode,
  connectorStyle,
  connectorAnimation,
  connectorColor,
  connectorThickness,
  penColor,
  penThickness,
  gridType,
  boardBgColor,
  liveBgStyle,
  cursorStyle
}) {
  const [key, setKey] = useState('');
  const [name, setName] = useState('');

  // Small checkbox selections per item
  const [saveToolMode, setSaveToolMode] = useState(true);
  const [saveConnector, setSaveConnector] = useState(true);
  const [savePen, setSavePen] = useState(true);
  const [saveBoard, setSaveBoard] = useState(true);

  const handleSave = () => {
    if (!key) {
      alert('Please specify a trigger key!');
      return;
    }
    const cleanKey = key.trim().toLowerCase().charAt(0);
    if (!cleanKey) return;

    // Check collision with core keys
    const reserved = ['v', 'm', 'c', 'p', 'e'];
    if (reserved.includes(cleanKey)) {
      alert(`Key '${cleanKey.toUpperCase()}' is reserved for default toolbar tools.`);
      return;
    }

    const newPreset = {
      id: Math.random().toString(36).substring(2, 11),
      key: cleanKey,
      name: name.trim() || `Preset ${cleanKey.toUpperCase()}`,
      toolMode: saveToolMode ? toolMode : undefined,
      connectorStyle: saveConnector ? connectorStyle : undefined,
      connectorAnimation: saveConnector ? connectorAnimation : undefined,
      connectorColor: saveConnector ? connectorColor : undefined,
      connectorThickness: saveConnector ? connectorThickness : undefined,
      penColor: savePen ? penColor : undefined,
      penThickness: savePen ? penThickness : undefined,
      gridType: saveBoard ? gridType : undefined,
      boardBgColor: saveBoard ? boardBgColor : undefined,
      liveBgStyle: saveBoard ? liveBgStyle : undefined,
      cursorStyle: saveBoard ? cursorStyle : undefined
    };

    onSave(newPreset);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      {/* Trigger Key */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Trigger Key</label>
        <input 
          type="text" 
          value={key} 
          onChange={(e) => setKey(e.target.value.slice(0, 1))} 
          placeholder="E.G. O"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            color: '#fff',
            padding: '0.25rem 0.4rem',
            fontSize: '0.72rem',
            textAlign: 'center',
            textTransform: 'uppercase',
            width: '60px'
          }}
        />
      </div>

      {/* Preset Name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <label style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Preset Name</label>
        <input 
          type="text" 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          placeholder="e.g. 90° Green Flow"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            color: '#fff',
            padding: '0.25rem 0.4rem',
            fontSize: '0.72rem'
          }}
        />
      </div>

      {/* Preview Info */}
      <div 
        style={{ 
          background: 'rgba(255,255,255,0.02)', 
          border: '1px dashed rgba(255,255,255,0.06)', 
          borderRadius: '6px', 
          padding: '0.45rem', 
          fontSize: '0.68rem', 
          color: 'var(--color-text-muted)',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px'
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--accent-amber)', marginBottom: '2px' }}>Capturing Current Setup:</div>
        
        {/* Tool Mode */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: saveToolMode ? '#fff' : 'var(--color-text-muted)' }}>
          <input 
            type="checkbox" 
            checked={saveToolMode} 
            onChange={(e) => setSaveToolMode(e.target.checked)} 
            style={{ margin: 0, cursor: 'pointer' }}
          />
          <span>🔧 Tool Mode: <strong>{toolMode}</strong></span>
        </label>

        {/* Connector */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', cursor: 'pointer', color: saveConnector ? '#fff' : 'var(--color-text-muted)' }}>
          <input 
            type="checkbox" 
            checked={saveConnector} 
            onChange={(e) => setSaveConnector(e.target.checked)} 
            style={{ margin: '2px 0 0 0', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>📐 Connector: <strong>{connectorStyle} ({connectorAnimation})</strong></span>
            <span style={{ fontSize: '0.62rem', opacity: 0.8 }}>Color Preset: {connectorColor} | Line Weight: {connectorThickness}px</span>
          </div>
        </label>

        {/* Pen */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: savePen ? '#fff' : 'var(--color-text-muted)' }}>
          <input 
            type="checkbox" 
            checked={savePen} 
            onChange={(e) => setSavePen(e.target.checked)} 
            style={{ margin: 0, cursor: 'pointer' }}
          />
          <span>✏️ Brush Color: <strong>{penColor}</strong> | <strong>{penThickness}px</strong></span>
        </label>

        {/* Grid / Bg */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', cursor: 'pointer', color: saveBoard ? '#fff' : 'var(--color-text-muted)' }}>
          <input 
            type="checkbox" 
            checked={saveBoard} 
            onChange={(e) => setSaveBoard(e.target.checked)} 
            style={{ margin: '2px 0 0 0', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span>🖼️ Grid / Bg: <strong>{gridType}</strong> / <strong>{boardBgColor}</strong></span>
            <span style={{ fontSize: '0.62rem', opacity: 0.8 }}>({liveBgStyle})</span>
          </div>
        </label>
      </div>

      {/* Form Buttons */}
      <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
        <button
          onClick={handleSave}
          className="submenu-btn"
          style={{ flex: 1, background: 'var(--accent-indigo)', color: '#fff', padding: '0.35rem 0', justifyContent: 'center' }}
        >
          Save Preset
        </button>
        <button
          onClick={onCancel}
          className="submenu-btn"
          style={{ flex: 1, padding: '0.35rem 0', justifyContent: 'center' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default LeftVerticalToolbar;
