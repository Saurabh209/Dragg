import React, { useState, useEffect, useRef } from 'react';
import { 
  Wrench, 
  Eye, 
  Trash2, 
  Square, 
  RotateCcw, 
  X, 
  Minimize2, 
  Maximize2, 
  Copy, 
  Check, 
  Activity, 
  Layout, 
  Layers,
  MousePointer,
  HelpCircle,
  ZoomIn,
  Search
} from 'lucide-react';
import './DevTool.css';
import { getDraggItem, setDraggItem, removeDraggItem } from '../../utils/draggStorage';

export default function DevTool() {
  const [isDevActive, setIsDevActive] = useState(() => {
    const isUnlocked = typeof window !== 'undefined' && (getDraggItem('forceDevUnlocked', false) === true || getDraggItem('forceDevUnlocked') === 'true');
    const isSimulatedProd = typeof window !== 'undefined' && (getDraggItem('simulatedProd', false) === true || getDraggItem('simulatedProd') === 'true');
    return isUnlocked || (import.meta.env.DEV && !isSimulatedProd);
  });

  useEffect(() => {
    const handleEnvChange = () => {
      const isUnlocked = typeof window !== 'undefined' && (getDraggItem('forceDevUnlocked', false) === true || getDraggItem('forceDevUnlocked') === 'true');
      const isSimulatedProd = typeof window !== 'undefined' && (getDraggItem('simulatedProd', false) === true || getDraggItem('simulatedProd') === 'true');
      setIsDevActive(isUnlocked || (import.meta.env.DEV && !isSimulatedProd));
    };
    window.addEventListener('dragg-env-change', handleEnvChange);
    return () => window.removeEventListener('dragg-env-change', handleEnvChange);
  }, []);

  if (!isDevActive) return null;

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState('features');

  const [simulatedProd, setSimulatedProd] = useState(() => getDraggItem('simulatedProd', false) === true || getDraggItem('simulatedProd') === 'true');

  const toggleSimulatedProd = (val) => {
    setSimulatedProd(val);
    if (val) {
      setDraggItem('simulatedProd', true);
    } else {
      removeDraggItem('simulatedProd');
    }
    window.dispatchEvent(new Event('dragg-env-change'));
  };

  const [outlineEnabled, setOutlineEnabled] = useState(false);
  const [outlineColor, setOutlineColor] = useState('rgba(56, 189, 248, 0.6)');
  const [hoverInspectorEnabled, setHoverInspectorEnabled] = useState(false);
  const [rightClickDeleteEnabled, setRightClickDeleteEnabled] = useState(false);

  const [lensEnabled, setLensEnabled] = useState(false);
  const [lensZoom, setLensZoom] = useState(2.5);
  const lensElementRef = useRef(null);
  const lensViewportRef = useRef(null);
  const lastLensTargetRef = useRef(null);

  const [hoverInfo, setHoverInfo] = useState(null);
  const [hoverBounds, setHoverBounds] = useState(null);

  const [deletedElements, setDeletedElements] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [domStats, setDomStats] = useState({ nodes: 0, images: 0, buttons: 0, inputs: 0, viewport: '' });
  const [copiedText, setCopiedText] = useState('');
  const [position, setPosition] = useState({ x: null, y: null });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const styleId = 'dev-tool-outline-style';
    let styleTag = document.getElementById(styleId);

    if (outlineEnabled) {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `
        *:not(#dev-tool-root *):not(#dev-tool-root):not(.dev-tool-context-menu *):not(.dev-tool-context-menu) {
          outline: 1px solid ${outlineColor} !important;
          outline-offset: -1px !important;
        }
      `;
    } else if (styleTag) {
      styleTag.remove();
    }

    return () => {
      const tag = document.getElementById(styleId);
      if (tag && !outlineEnabled) tag.remove();
    };
  }, [outlineEnabled, outlineColor]);

  useEffect(() => {
    return () => {
      const tag = document.getElementById('dev-tool-outline-style');
      if (tag) tag.remove();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setOutlineEnabled(false);
      setHoverInspectorEnabled(false);
      setLensEnabled(false);
      setContextMenu(null);
      setHoverInfo(null);
      setHoverBounds(null);
      if (lensElementRef.current) {
        lensElementRef.current.style.display = 'none';
        lastLensTargetRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const styleId = 'dev-tool-lens-cursor-style';
    let styleTag = document.getElementById(styleId);

    if (lensEnabled && isOpen) {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `
        *:not(#dev-tool-root *):not(#dev-tool-root):not(.dev-tool-context-menu *):not(.dev-tool-context-menu) {
          cursor: none !important;
        }
      `;
    } else if (styleTag) {
      styleTag.remove();
    }

    return () => {
      const tag = document.getElementById(styleId);
      if (tag) tag.remove();
    };
  }, [lensEnabled, isOpen]);

  const activeTargetRef = useRef(null);
  const mousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!hoverInspectorEnabled && !lensEnabled) {
      setHoverInfo(null);
      setHoverBounds(null);
      if (lensElementRef.current) {
        lensElementRef.current.style.display = 'none';
        lastLensTargetRef.current = null;
      }
      activeTargetRef.current = null;
      return;
    }

    let animId;

    const handlePointerMove = (e) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };

      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target || target.closest('#dev-tool-root') || target.closest('.dev-tool-context-menu')) {
        activeTargetRef.current = null;
        setHoverInfo(null);
        setHoverBounds(null);
        if (lensElementRef.current) {
          lensElementRef.current.style.display = 'none';
          lastLensTargetRef.current = null;
        }
        return;
      }

      activeTargetRef.current = target;
    };

    const updateFrame = () => {
      const target = activeTargetRef.current;
      if (target && document.body.contains(target)) {
        const rect = target.getBoundingClientRect();

        if (hoverInspectorEnabled) {
          const computed = window.getComputedStyle(target);

          const compactBox = (t, r, b, l) => {
            if (t === r && r === b && b === l) return t;
            if (t === b && r === l) return `${t} ${r}`;
            return `${t} ${r} ${b} ${l}`;
          };

          const paddingVal = compactBox(
            computed.paddingTop,
            computed.paddingRight,
            computed.paddingBottom,
            computed.paddingLeft
          );

          const marginVal = compactBox(
            computed.marginTop,
            computed.marginRight,
            computed.marginBottom,
            computed.marginLeft
          );

          const cssProps = {
            display: computed.display,
            position: computed.position,
            fontSize: computed.fontSize,
            color: computed.color,
            background: computed.backgroundColor,
            padding: paddingVal,
            margin: marginVal,
            zIndex: computed.zIndex === 'auto' ? 'auto' : computed.zIndex,
          };

          setHoverBounds({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          });

          const badgeWidth = 380;
          const badgeHeight = 180;
          const tooltipX = Math.max(10, Math.min(mousePosRef.current.x + 15, window.innerWidth - badgeWidth - 15));
          const tooltipY = Math.max(10, Math.min(mousePosRef.current.y + 15, window.innerHeight - badgeHeight - 15));

          setHoverInfo({
            x: tooltipX,
            y: tooltipY,
            tagName: target.tagName.toLowerCase(),
            id: target.id ? `#${target.id}` : '',
            className: target.className && typeof target.className === 'string' ? `.${target.className.trim().split(/\s+/).join('.')}` : '',
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            css: cssProps,
          });
        } else {
          setHoverInfo(null);
          setHoverBounds(null);
        }

        if (lensEnabled && lensElementRef.current && lensViewportRef.current) {
          const lensEl = lensElementRef.current;
          const viewportEl = lensViewportRef.current;

          lensEl.style.display = 'block';
          lensEl.style.left = `${mousePosRef.current.x - 80}px`;
          lensEl.style.top = `${mousePosRef.current.y - 80}px`;

          if (lastLensTargetRef.current !== target) {
            lastLensTargetRef.current = target;
            viewportEl.innerHTML = '';

            const clone = target.cloneNode(true);
            clone.style.margin = '0';
            clone.style.pointerEvents = 'none';

            const origCanvases = target.tagName === 'CANVAS' ? [target] : target.querySelectorAll('canvas');
            const cloneCanvases = clone.tagName === 'CANVAS' ? [clone] : clone.querySelectorAll('canvas');
            origCanvases.forEach((orig, idx) => {
              const dest = cloneCanvases[idx];
              if (dest) {
                dest.width = orig.width;
                dest.height = orig.height;
                const destCtx = dest.getContext('2d');
                if (destCtx) destCtx.drawImage(orig, 0, 0);
              }
            });

            viewportEl.appendChild(clone);
          }

          const offsetX = mousePosRef.current.x - rect.left;
          const offsetY = mousePosRef.current.y - rect.top;

          viewportEl.style.width = `${rect.width}px`;
          viewportEl.style.height = `${rect.height}px`;
          viewportEl.style.left = `${80 - offsetX * lensZoom}px`;
          viewportEl.style.top = `${80 - offsetY * lensZoom}px`;
          viewportEl.style.transform = `scale(${lensZoom})`;
          viewportEl.style.transformOrigin = '0 0';
        } else if (lensElementRef.current) {
          lensElementRef.current.style.display = 'none';
          lastLensTargetRef.current = null;
        }
      } else {
        activeTargetRef.current = null;
        setHoverInfo(null);
        setHoverBounds(null);
        if (lensElementRef.current) {
          lensElementRef.current.style.display = 'none';
          lastLensTargetRef.current = null;
        }
      }

      animId = requestAnimationFrame(updateFrame);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('scroll', updateFrame, { capture: true, passive: true });
    window.addEventListener('resize', updateFrame, { passive: true });

    animId = requestAnimationFrame(updateFrame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('scroll', updateFrame, { capture: true });
      window.removeEventListener('resize', updateFrame);
    };
  }, [hoverInspectorEnabled, lensEnabled, lensZoom]);

  useEffect(() => {
    if (!rightClickDeleteEnabled || !isOpen) {
      setContextMenu(null);
      return;
    }

    const handleContextMenu = (e) => {
      const target = e.target;
      if (!target) return;

      if (target.closest('#dev-tool-root') || target.closest('.dev-tool-context-menu')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        target,
      });
    };

    const handleClickOutside = (e) => {
      if (contextMenu && !e.target.closest('.dev-tool-context-menu')) {
        setContextMenu(null);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu, true);
    window.addEventListener('click', handleClickOutside, true);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, true);
      window.removeEventListener('click', handleClickOutside, true);
    };
  }, [rightClickDeleteEnabled, isOpen, contextMenu]);

  const refreshDomStats = () => {
    const nodes = document.getElementsByTagName('*').length;
    const images = document.getElementsByTagName('img').length;
    const buttons = document.getElementsByTagName('button').length;
    const inputs = document.getElementsByTagName('input').length;
    const viewport = `${window.innerWidth} × ${window.innerHeight}`;
    setDomStats({ nodes, images, buttons, inputs, viewport });
  };

  useEffect(() => {
    if (isOpen && activeTab === 'stats') {
      refreshDomStats();
      const interval = setInterval(refreshDomStats, 2000);
      return () => clearInterval(interval);
    }
  }, [isOpen, activeTab]);

  const handleDeleteElement = (target) => {
    if (!target) return;

    const prevDisplay = target.style.display;
    const prevVisibility = target.style.visibility;

    target.style.setProperty('display', 'none', 'important');
    target.style.setProperty('visibility', 'hidden', 'important');
    target.setAttribute('data-dev-tool-hidden', 'true');

    const item = {
      id: Date.now() + Math.random(),
      element: target,
      tagName: target.tagName.toLowerCase(),
      className: target.className && typeof target.className === 'string' ? target.className : '',
      textSnippet: target.innerText ? target.innerText.slice(0, 35) : target.getAttribute('alt') || target.getAttribute('placeholder') || '',
      prevDisplay,
      prevVisibility,
    };

    setDeletedElements((prev) => [item, ...prev]);
    setContextMenu(null);
  };

  const handleRestoreElement = (id) => {
    setDeletedElements((prev) => {
      const item = prev.find((el) => el.id === id);
      if (item && item.element) {
        item.element.style.removeProperty('display');
        item.element.style.removeProperty('visibility');
        if (item.prevDisplay) item.element.style.display = item.prevDisplay;
        if (item.prevVisibility) item.element.style.visibility = item.prevVisibility;
        item.element.removeAttribute('data-dev-tool-hidden');
      }
      return prev.filter((el) => el.id !== id);
    });
  };

  const handleRestoreAll = () => {
    deletedElements.forEach((item) => {
      if (item.element) {
        item.element.style.removeProperty('display');
        item.element.style.removeProperty('visibility');
        if (item.prevDisplay) item.element.style.display = item.prevDisplay;
        if (item.prevVisibility) item.element.style.visibility = item.prevVisibility;
        item.element.removeAttribute('data-dev-tool-hidden');
      }
    });
    setDeletedElements([]);
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
    setContextMenu(null);
  };

  const handleMouseDownHeader = (e) => {
    if (e.target.closest('.dev-tool-actions')) return;
    isDraggingRef.current = true;

    const bar = document.querySelector('.dev-tool-bar');
    if (bar) {
      const rect = bar.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }

    const handleMouseMoveWindow = (eMove) => {
      if (!isDraggingRef.current) return;
      const newX = Math.max(10, Math.min(window.innerWidth - 420, eMove.clientX - dragOffsetRef.current.x));
      const newY = Math.max(10, Math.min(window.innerHeight - 100, eMove.clientY - dragOffsetRef.current.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUpWindow = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMoveWindow);
      window.removeEventListener('mouseup', handleMouseUpWindow);
    };

    window.addEventListener('mousemove', handleMouseMoveWindow);
    window.addEventListener('mouseup', handleMouseUpWindow);
  };

  return (
    <div id="dev-tool-root">
      {!isOpen && (
        <button 
          className="dev-tool-trigger"
          onClick={() => setIsOpen(true)}
          title="Open DevTool (Ctrl + Shift + D)"
        >
          <Wrench size={14} />
          <span>DevTool</span>
          <span className="dev-tool-trigger-kbd">Ctrl+Shift+D</span>
        </button>
      )}

      {hoverInspectorEnabled && hoverBounds && (
        <div 
          className="dev-tool-hover-overlay"
          style={{
            left: `${hoverBounds.left}px`,
            top: `${hoverBounds.top}px`,
            width: `${hoverBounds.width}px`,
            height: `${hoverBounds.height}px`,
          }}
        />
      )}

      {hoverInspectorEnabled && hoverInfo && (
        <div 
          className="dev-tool-inspector-badge"
          style={{
            left: `${hoverInfo.x}px`,
            top: `${hoverInfo.y}px`,
          }}
        >
          <div className="dev-tool-inspector-header">
            <span className="dev-tool-inspector-tag">&lt;{hoverInfo.tagName}&gt;</span>
            <span className="dev-tool-inspector-class">{hoverInfo.id} {hoverInfo.className}</span>
            <span className="dev-tool-inspector-dim">{hoverInfo.width}×{hoverInfo.height}px</span>
          </div>

          <div className="dev-tool-inspector-grid">
            <div className="dev-tool-inspector-prop">
              <span className="dev-tool-inspector-key">display:</span>
              <span className="dev-tool-inspector-val">{hoverInfo.css.display}</span>
            </div>
            <div className="dev-tool-inspector-prop">
              <span className="dev-tool-inspector-key">position:</span>
              <span className="dev-tool-inspector-val">{hoverInfo.css.position}</span>
            </div>
            <div className="dev-tool-inspector-prop">
              <span className="dev-tool-inspector-key">margin:</span>
              <span className="dev-tool-inspector-val">{hoverInfo.css.margin}</span>
            </div>
            <div className="dev-tool-inspector-prop">
              <span className="dev-tool-inspector-key">padding:</span>
              <span className="dev-tool-inspector-val">{hoverInfo.css.padding}</span>
            </div>
            <div className="dev-tool-inspector-prop">
              <span className="dev-tool-inspector-key">color:</span>
              <span className="dev-tool-inspector-val">{hoverInfo.css.color}</span>
            </div>
            <div className="dev-tool-inspector-prop">
              <span className="dev-tool-inspector-key">z-index:</span>
              <span className="dev-tool-inspector-val">{hoverInfo.css.zIndex}</span>
            </div>
          </div>
        </div>
      )}

      {lensEnabled && (
        <div 
          className="dev-tool-lens"
          ref={lensElementRef}
          style={{ display: 'none' }}
        >
          <div 
            className="dev-tool-lens-viewport"
            ref={lensViewportRef}
          />
          <div className="dev-tool-lens-crosshair" />
          <div className="dev-tool-lens-badge">{lensZoom}x</div>
        </div>
      )}

      {contextMenu && (
        <div 
          className="dev-tool-context-menu"
          style={{
            left: `${Math.min(contextMenu.x, window.innerWidth - 220)}px`,
            top: `${Math.min(contextMenu.y, window.innerHeight - 180)}px`,
          }}
        >
          <div className="dev-tool-context-header">
            &lt;{contextMenu.target.tagName.toLowerCase()}&gt; {contextMenu.target.className ? `.${String(contextMenu.target.className).split(' ')[0]}` : ''}
          </div>

          <button 
            className="dev-tool-context-item danger"
            onClick={() => handleDeleteElement(contextMenu.target)}
          >
            <Trash2 size={13} />
            <span>Delete from DOM (Temp)</span>
          </button>

          <div className="dev-tool-context-divider" />

          <button 
            className="dev-tool-context-item"
            onClick={() => handleCopy(contextMenu.target.className || '', 'Class Names')}
          >
            <Copy size={13} />
            <span>Copy Class Names</span>
          </button>

          <button 
            className="dev-tool-context-item"
            onClick={() => handleCopy(contextMenu.target.outerHTML || '', 'Outer HTML')}
          >
            <Copy size={13} />
            <span>Copy Outer HTML</span>
          </button>
        </div>
      )}

      {isOpen && (
        <div 
          className={`dev-tool-bar ${isMinimized ? 'minimized' : ''}`}
          style={position.x !== null ? { left: `${position.x}px`, top: `${position.y}px`, bottom: 'auto', right: 'auto' } : {}}
        >
          <div className="dev-tool-header" onMouseDown={handleMouseDownHeader}>
            <div className="dev-tool-title-group">
              <Wrench size={15} style={{ color: '#38bdf8' }} />
              <span>DevTool</span>
              <span className="dev-tool-badge">Ctrl+Shift+D</span>
            </div>

            <div className="dev-tool-actions">
              <button 
                className="dev-tool-btn-icon"
                onClick={() => setIsMinimized((prev) => !prev)}
                title={isMinimized ? 'Expand Panel' : 'Minimize Panel'}
              >
                {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
              </button>
              <button 
                className="dev-tool-btn-icon"
                onClick={() => setIsOpen(false)}
                title="Close DevTool"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              <div className="dev-tool-tabs">
                <button 
                  className={`dev-tool-tab ${activeTab === 'features' ? 'active' : ''}`}
                  onClick={() => setActiveTab('features')}
                >
                  <Layout size={13} />
                  <span>Tools & Outlines</span>
                </button>
                <button 
                  className={`dev-tool-tab ${activeTab === 'hidden' ? 'active' : ''}`}
                  onClick={() => setActiveTab('hidden')}
                >
                  <Layers size={13} />
                  <span>Hidden Elements</span>
                  {deletedElements.length > 0 && (
                    <span className="dev-tool-tab-count">{deletedElements.length}</span>
                  )}
                </button>
                <button 
                  className={`dev-tool-tab ${activeTab === 'stats' ? 'active' : ''}`}
                  onClick={() => setActiveTab('stats')}
                >
                  <Activity size={13} />
                  <span>DOM Stats</span>
                </button>
              </div>

              <div className="dev-tool-body">
                {activeTab === 'features' && (
                  <div className="dev-tool-section">
                    <div className="dev-tool-option" style={{ border: '1px solid rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', padding: '10px' }}>
                      <label className="dev-tool-option-label">
                        <input 
                          type="checkbox"
                          className="dev-tool-checkbox"
                          checked={simulatedProd}
                          onChange={(e) => toggleSimulatedProd(e.target.checked)}
                        />
                        <div className="dev-tool-option-info">
                          <span className="dev-tool-option-name" style={{ color: '#fef08a', fontWeight: 700 }}>🚀 Simulate Production Mode</span>
                          <span className="dev-tool-option-desc">Toggle locally to test Production user access restrictions & hover prompts</span>
                        </div>
                      </label>
                    </div>

                    <div className="dev-tool-section-title">Layout & Inspection Tools</div>

                    <div className="dev-tool-option">
                      <label className="dev-tool-option-label">
                        <input 
                          type="checkbox"
                          className="dev-tool-checkbox"
                          checked={outlineEnabled}
                          onChange={(e) => setOutlineEnabled(e.target.checked)}
                        />
                        <div className="dev-tool-option-info">
                          <span className="dev-tool-option-name">Force Outline Everything</span>
                          <span className="dev-tool-option-desc">Applies clean 1px outlines to all DOM elements to analyze layout structure</span>
                        </div>
                      </label>

                      {outlineEnabled && (
                        <select 
                          className="dev-tool-select"
                          value={outlineColor}
                          onChange={(e) => setOutlineColor(e.target.value)}
                        >
                          <option value="rgba(56, 189, 248, 0.65)">Slate Blue</option>
                          <option value="rgba(16, 185, 129, 0.65)">Emerald Green</option>
                          <option value="rgba(245, 158, 11, 0.65)">Amber Orange</option>
                          <option value="rgba(239, 68, 68, 0.65)">Crimson Red</option>
                        </select>
                      )}
                    </div>

                    <div className="dev-tool-option">
                      <label className="dev-tool-option-label">
                        <input 
                          type="checkbox"
                          className="dev-tool-checkbox"
                          checked={hoverInspectorEnabled}
                          onChange={(e) => setHoverInspectorEnabled(e.target.checked)}
                        />
                        <div className="dev-tool-option-info">
                          <span className="dev-tool-option-name">Hover Element Inspector</span>
                          <span className="dev-tool-option-desc">Hover over any element to display class name, CSS dimensions & styles</span>
                        </div>
                      </label>
                    </div>

                    <div className="dev-tool-option">
                      <label className="dev-tool-option-label">
                        <input 
                          type="checkbox"
                          className="dev-tool-checkbox"
                          checked={lensEnabled}
                          onChange={(e) => setLensEnabled(e.target.checked)}
                        />
                        <div className="dev-tool-option-info">
                          <span className="dev-tool-option-name">Magnifying Lens (Zoom Lens)</span>
                          <span className="dev-tool-option-desc">Cursor lens that magnifies icons, text, and small details in large scale</span>
                        </div>
                      </label>

                      {lensEnabled && (
                        <select 
                          className="dev-tool-select"
                          value={lensZoom}
                          onChange={(e) => setLensZoom(parseFloat(e.target.value))}
                        >
                          <option value="1.5">1.5x Zoom</option>
                          <option value="2">2.0x Zoom</option>
                          <option value="2.5">2.5x Zoom</option>
                          <option value="3">3.0x Zoom</option>
                          <option value="4">4.0x Zoom</option>
                        </select>
                      )}
                    </div>

                    <div className="dev-tool-option">
                      <label className="dev-tool-option-label">
                        <input 
                          type="checkbox"
                          className="dev-tool-checkbox"
                          checked={rightClickDeleteEnabled}
                          onChange={(e) => setRightClickDeleteEnabled(e.target.checked)}
                        />
                        <div className="dev-tool-option-info">
                          <span className="dev-tool-option-name">Right-Click DOM Removal</span>
                          <span className="dev-tool-option-desc">Right-click on any DOM element to temporarily delete or copy properties</span>
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {activeTab === 'hidden' && (
                  <div className="dev-tool-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="dev-tool-section-title">Temporarily Hidden Elements ({deletedElements.length})</div>
                      {deletedElements.length > 0 && (
                        <button className="dev-tool-btn dev-tool-btn-primary" onClick={handleRestoreAll}>
                          <RotateCcw size={12} />
                          <span>Restore All</span>
                        </button>
                      )}
                    </div>

                    {deletedElements.length === 0 ? (
                      <div className="dev-tool-empty-state">
                        No elements have been hidden yet.<br />
                        Right-click on any element on the page and select "Delete from DOM (Temp)" to test!
                      </div>
                    ) : (
                      <div className="dev-tool-deleted-list">
                        {deletedElements.map((item) => (
                          <div key={item.id} className="dev-tool-deleted-item">
                            <div className="dev-tool-deleted-info">
                              <span className="dev-tool-deleted-tag">
                                &lt;{item.tagName}&gt; {item.className ? `.${item.className}` : ''}
                              </span>
                              {item.textSnippet && (
                                <span className="dev-tool-deleted-text">"{item.textSnippet}"</span>
                              )}
                            </div>

                            <button 
                              className="dev-tool-btn"
                              onClick={() => handleRestoreElement(item.id)}
                              title="Restore element to DOM"
                            >
                              <RotateCcw size={12} />
                              <span>Restore</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'stats' && (
                  <div className="dev-tool-section">
                    <div className="dev-tool-section-title">Live DOM Diagnostics</div>

                    <div className="dev-tool-stats-grid">
                      <div className="dev-tool-stat-card">
                        <span className="dev-tool-stat-value">{domStats.nodes}</span>
                        <span className="dev-tool-stat-label">Total DOM Nodes</span>
                      </div>
                      <div className="dev-tool-stat-card">
                        <span className="dev-tool-stat-value">{domStats.viewport}</span>
                        <span className="dev-tool-stat-label">Viewport Size</span>
                      </div>
                      <div className="dev-tool-stat-card">
                        <span className="dev-tool-stat-value">{domStats.buttons}</span>
                        <span className="dev-tool-stat-label">Buttons</span>
                      </div>
                      <div className="dev-tool-stat-card">
                        <span className="dev-tool-stat-value">{domStats.images}</span>
                        <span className="dev-tool-stat-label">Images</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="dev-tool-footer">
                <span>Press <kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '3px', color: '#cbd5e1' }}>Ctrl + Shift + D</kbd> to toggle</span>
                {copiedText && (
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>Copied {copiedText}!</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
