import React, { useState, useEffect, useRef } from 'react';
import Card, { LANGUAGES, getPlaceholderForLang } from './Card';
import Toolbar from './Toolbar';
import { ArrowLeft, Lock, Unlock, Eye, Code2, X, Play, List, Search, Compass, Maximize2, Minimize2 } from 'lucide-react';
import { toPng } from 'html-to-image';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function CanvasBoard({ boardId, boardPassword, onUpdatePassword, onBack, showToast, forceViewOnly = false }) {
  const [boardName, setBoardName] = useState('');
  const [cards, setCards] = useState([]);
  const [connections, setConnections] = useState([]);
  const [drawings, setDrawings] = useState([]); // Array of strokes: { tool, color, thickness, points }
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [zoom, setZoom] = useState(1.0);
  const [gridVisible, setGridVisible] = useState(true);
  const [selectedCardId, setSelectedCardId] = useState(null);
  
  // Security locks states
  const [localPassword, setLocalPassword] = useState(boardPassword || '');
  const [protectionMode, setProtectionMode] = useState('none');
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockPassInput, setUnlockPassInput] = useState('');

  // Viewport mode controls
  const [toolMode, setToolMode] = useState('select'); // 'select' | 'connector' | 'pen' | 'ruler'
  const [penColor, setPenColor] = useState('#ffffff');
  const [penThickness, setPenThickness] = useState(5);

  // Active stroke drawing reference
  const [activeStroke, setActiveStroke] = useState(null);

  // "saved" | "saving" | "error"
  const [saveStatus, setSaveStatus] = useState('saved');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState(null);
  const [timeTick, setTimeTick] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [shouldGlowAlert, setShouldGlowAlert] = useState(false);
  const unsavedSinceRef = useRef(null);

  // For connection creation
  const [draftConnection, setDraftConnection] = useState(null);

  // Custom clear board confirmation modal state
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Global Code Sandbox state
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(false);
  const [boardCode, setBoardCode] = useState('');
  const [boardLanguage, setBoardLanguage] = useState('javascript');
  const [isCodeRunning, setIsCodeRunning] = useState(false);
  const [codeOutput, setCodeOutput] = useState('');
  const [codeError, setCodeError] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Canvas Outline Sidebar state
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [blinkingCardId, setBlinkingCardId] = useState(null);

  // Keybindings from localStorage
  const [keybindings] = useState(() => {
    const saved = localStorage.getItem('dragg-keybindings');
    if (saved) return JSON.parse(saved);
    return {
      panUp: { key: 'w', code: 'KeyW', label: 'Pan Up' },
      panDown: { key: 's', code: 'KeyS', label: 'Pan Down' },
      panLeft: { key: 'a', code: 'KeyA', label: 'Pan Left' },
      panRight: { key: 'd', code: 'KeyD', label: 'Pan Right' },
      zoomIn: { key: '=', code: 'Equal', label: 'Zoom In' },
      zoomOut: { key: '-', code: 'Minus', label: 'Zoom Out' },
      selectMode: { key: 'v', code: 'KeyV', label: 'Select Mode' },
      connectorMode: { key: 'c', code: 'KeyC', label: 'Connector Mode' },
      eraserMode: { key: 'e', code: 'KeyE', label: 'Eraser Mode' },
    };
  });

  const containerRef = useRef(null);
  const isPanningRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const isInitialLoad = useRef(true);

  // Touch tracking state
  const touchStateRef = useRef({
    isInteracting: false,
    touches: [],
    startPan: { x: 0, y: 0 },
    startZoom: 1.0,
    startDistance: 0,
    startCenter: { x: 0, y: 0 }
  });

  const isViewOnly = forceViewOnly || (protectionMode !== 'none' && !localPassword);

  // Fullscreen event listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!(document.fullscreenElement ||
           document.webkitFullscreenElement ||
           document.mozFullScreenElement ||
           document.msFullscreenElement)
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!isFullscreen) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) { /* Safari */
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) { /* IE11 */
        elem.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) { /* Safari */
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) { /* IE11 */
        document.msExitFullscreen();
      }
    }
  };

  // Load board details
  useEffect(() => {
    const fetchBoardDetails = async () => {
      try {
        const res = await fetch(`${API_BASE}/boards/${boardId}`, {
          headers: {
            'x-board-password': localPassword
          }
        });
        if (!res.ok) throw new Error('Board not found');
        const data = await res.json();
        
        setBoardName(data.name || 'Untitled Board');
        setCards(data.cards || []);
        setConnections(data.connections || []);
        setDrawings(data.drawings || []);
        setPan(data.pan || { x: 100, y: 100 });
        setZoom(data.zoom || 1.0);
        setProtectionMode(data.protectionMode || 'none');
        setBoardCode(data.code || '');
        setBoardLanguage(data.language || 'javascript');
        
        setTimeout(() => {
          isInitialLoad.current = false;
          setLastSavedTimestamp(Date.now());
        }, 100);
      } catch (err) {
        console.error(err);
        showToast('Error loading board data.', 'error');
        onBack();
      }
    };
    fetchBoardDetails();
  }, [boardId]);

  // Keyboard shortcut listener for modes and canvas pan/zoom remapped keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.hasAttribute('contenteditable') ||
        document.activeElement.closest('[contenteditable]')
      ) {
        return;
      }
      
      const code = e.code;
      if (code === keybindings.selectMode.code) {
        setToolMode('select');
        showToast('Select & Move mode active');
      } else if (code === keybindings.connectorMode.code) {
        setToolMode('connector');
        showToast('Connection mode active. Drag cards to link them.');
      } else if (code === keybindings.eraserMode.code) {
        setToolMode('eraser');
        showToast('Stroke Eraser active. Drag to erase canvas drawings.');
      } else if (code === keybindings.zoomIn.code) {
        setZoom((z) => Math.min(3.0, z + 0.1));
      } else if (code === keybindings.zoomOut.code) {
        setZoom((z) => Math.max(0.15, z - 0.1));
      } else if (code === keybindings.panUp.code) {
        setPan(prev => ({ ...prev, y: prev.y + 35 }));
      } else if (code === keybindings.panDown.code) {
        setPan(prev => ({ ...prev, y: prev.y - 35 }));
      } else if (code === keybindings.panLeft.code) {
        setPan(prev => ({ ...prev, x: prev.x + 35 }));
      } else if (code === keybindings.panRight.code) {
        setPan(prev => ({ ...prev, x: prev.x - 35 }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keybindings]);

  // Reference to track the latest canvas state variables to avoid resetting intervals
  const latestDataRef = useRef({ boardName, cards, connections, drawings, pan, zoom, boardCode, boardLanguage });
  useEffect(() => {
    latestDataRef.current = { boardName, cards, connections, drawings, pan, zoom, boardCode, boardLanguage };
  }, [boardName, cards, connections, drawings, pan, zoom, boardCode, boardLanguage]);

  const getRelativeTimeString = (timestamp) => {
    if (!timestamp) return '';
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    
    if (diffSec < 60) {
      return 'just now';
    } else if (diffMin < 60) {
      return `${diffMin} ${diffMin === 1 ? 'min' : 'mins'} ago`;
    } else {
      return `${diffHr} ${diffHr === 1 ? 'hour' : 'hours'} ago`;
    }
  };

  const getSaveStatusLabel = () => {
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'error') return 'Error (Offline)';
    
    const relativeTime = getRelativeTimeString(lastSavedTimestamp);
    if (hasUnsavedChanges) {
      const timePart = relativeTime ? ` (Last saved: ${relativeTime})` : '';
      return shouldGlowAlert ? `Unsaved (Overdue!)${timePart}` : `Unsaved Changes${timePart}`;
    }
    return relativeTime ? `Last saved: ${relativeTime}` : 'Saved';
  };

  const getSaveDotClass = () => {
    if (saveStatus === 'saving') return 'saving';
    if (saveStatus === 'error') return 'error';
    if (hasUnsavedChanges) {
      return shouldGlowAlert ? 'error' : 'saving'; // red if overdue, amber if unsaved
    }
    return 'saved'; // green if up-to-date
  };

  // Unified save board API function
  const handleSaveBoard = async (isManual = false) => {
    if (isViewOnly) return;
    setSaveStatus('saving');
    try {
      const dataToSave = latestDataRef.current;
      const res = await fetch(`${API_BASE}/boards/${boardId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-board-password': localPassword
        },
        body: JSON.stringify({
          name: dataToSave.boardName,
          cards: dataToSave.cards,
          connections: dataToSave.connections,
          drawings: dataToSave.drawings,
          pan: dataToSave.pan,
          zoom: dataToSave.zoom,
          code: dataToSave.boardCode,
          language: dataToSave.boardLanguage,
        }),
      });
      if (!res.ok) throw new Error('Failed to save board');
      setSaveStatus('saved');
      setHasUnsavedChanges(false);
      setShouldGlowAlert(false);
      unsavedSinceRef.current = null;
      setLastSavedTimestamp(Date.now());
      if (isManual) {
        showToast('Board saved successfully!', 'success');
      }
    } catch (err) {
      console.error('Save error:', err);
      setSaveStatus('error');
      if (isManual) {
        showToast('Error saving board: ' + err.message, 'error');
      }
    }
  };

  // Periodic autosave running every 15 minutes
  useEffect(() => {
    if (isInitialLoad.current || isViewOnly) return;

    if (!lastSavedTimestamp) {
      setLastSavedTimestamp(Date.now());
    }

    const intervalId = setInterval(() => {
      handleSaveBoard(false);
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(intervalId);
  }, [boardId, isViewOnly, localPassword]);

  // Track actual board edits to set hasUnsavedChanges
  useEffect(() => {
    if (isInitialLoad.current || isViewOnly) return;

    setHasUnsavedChanges(true);
    if (!unsavedSinceRef.current) {
      unsavedSinceRef.current = Date.now();
    }
  }, [cards, connections, drawings, boardName, boardCode, boardLanguage]);

  // Monitor elapsed time since the first unsaved change and trigger alert glow if > 5 minutes
  useEffect(() => {
    const checkGlowInterval = setInterval(() => {
      // Force component re-render to update relative time text
      setTimeTick((t) => t + 1);

      if (unsavedSinceRef.current) {
        const elapsedMs = Date.now() - unsavedSinceRef.current;
        if (elapsedMs >= 5 * 60 * 1000) { // 5 minutes
          setShouldGlowAlert(true);
        } else {
          setShouldGlowAlert(false);
        }
      } else {
        setShouldGlowAlert(false);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(checkGlowInterval);
  }, []);

  // Conversion: Screen coordinates -> Canvas coordinates
  const screenToCanvas = (clientX, clientY) => {
    if (!containerRef.current) return { x: clientX, y: clientY };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / zoom;
    const y = (clientY - rect.top - pan.y) / zoom;
    return { x, y };
  };

  // Canvas MouseDown router
  const handleContainerMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only

    // STROKE ERASER MODE
    if (toolMode === 'eraser') {
      if (isViewOnly) {
        showToast('Board is locked. Enter password to erase sketches.', 'error');
        return;
      }
      e.preventDefault();

      const eraseAt = (clientX, clientY) => {
        const coords = screenToCanvas(clientX, clientY);
        const eraseRadius = 15 / zoom; // Match visual scale relative to zoom level
        setDrawings((prev) => prev.filter((stroke) => {
          const hit = stroke.points.some((p) => {
            const dx = p.x - coords.x;
            const dy = p.y - coords.y;
            return dx * dx + dy * dy < eraseRadius * eraseRadius; // Avoid Math.sqrt for speed
          });
          return !hit;
        }));
      };

      // Erase at initial click coordinate
      eraseAt(e.clientX, e.clientY);

      const handleMouseMove = (moveEvent) => {
        eraseAt(moveEvent.clientX, moveEvent.clientY);
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return;
    }

    // DRAWING MODES (Pen or Ruler)
    if (toolMode === 'pen' || toolMode === 'ruler') {
      if (isViewOnly) {
        showToast('Board is locked. Enter password to draw sketches.', 'error');
        return;
      }
      e.preventDefault();
      const canvasCoords = screenToCanvas(e.clientX, e.clientY);
      // Initialize active stroke
      setActiveStroke({
        tool: toolMode,
        color: penColor,
        thickness: penThickness,
        points: [canvasCoords],
      });

      const handleMouseMove = (moveEvent) => {
        const currentCoords = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
        
        setActiveStroke((prev) => {
          if (!prev) return null;
          if (prev.tool === 'ruler' || moveEvent.shiftKey) {
            // Ruler mode / Shift key locks a straight line from start to current
            return {
              ...prev,
              points: [prev.points[0], currentCoords],
            };
          } else {
            // Freehand pen
            return {
              ...prev,
              points: [...prev.points, currentCoords],
            };
          }
        });
      };

      const handleMouseUp = () => {
        setActiveStroke((completed) => {
          if (completed && completed.points.length > 0) {
            setDrawings((prev) => [...prev, completed]);
          }
          return null;
        });
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return;
    }

    // PANNING MODE (Select mode when clicking empty canvas or view-only drag from anywhere)
    const isInteractive = e.target.closest('button') || e.target.closest('a') || e.target.closest('select') || e.target.closest('input:not(.card-title-input)');
    const isViewOnlyDrag = isViewOnly && !isInteractive;
    const isBgDrag = e.target === containerRef.current || e.target.className === 'canvas-grid';

    if (isBgDrag || isViewOnlyDrag) {
      isPanningRef.current = true;
      const startX = e.clientX - pan.x;
      const startY = e.clientY - pan.y;

      const handleMouseMove = (moveEvent) => {
        if (!isPanningRef.current) return;
        setPan({
          x: moveEvent.clientX - startX,
          y: moveEvent.clientY - startY,
        });
      };

      const handleMouseUp = () => {
        isPanningRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };

  // Zoom on wheel (relative to cursor)
  const handleWheel = (e) => {
    if (e.target.closest('.outline-sidebar-panel') || e.target.closest('.code-split-panel')) {
      return;
    }
    
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasX = (mouseX - pan.x) / zoom;
    const canvasY = (mouseY - pan.y) / zoom;

    const zoomIntensity = 0.08;
    const delta = -e.deltaY;
    const factor = delta > 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
    const newZoom = Math.min(3.0, Math.max(0.15, zoom * factor));

    const newPanX = mouseX - canvasX * newZoom;
    const newPanY = mouseY - canvasY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleWheelRef = useRef(handleWheel);
  useEffect(() => {
    handleWheelRef.current = handleWheel;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheelEvent = (e) => {
      if (handleWheelRef.current) {
        handleWheelRef.current(e);
      }
    };

    container.addEventListener('wheel', onWheelEvent, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheelEvent);
    };
  }, []);

  // Touch event handlers for mobile/tablet canvas navigation
  const handleTouchStart = (e) => {
    // Check if touch target is interactive
    const isInteractive = e.target.closest('button') || 
                          e.target.closest('a') || 
                          e.target.closest('select') || 
                          e.target.closest('input') ||
                          e.target.closest('.card-content-textarea') ||
                          e.target.closest('[contenteditable]') ||
                          e.target.closest('.notes-format-bar') ||
                          e.target.closest('.card-sketch-toolbar') ||
                          e.target.closest('.outline-sidebar-panel') ||
                          e.target.closest('.code-split-panel');
    if (isInteractive) return;

    // View-only mode or empty background click can pan the canvas
    const isViewOnlyDrag = isViewOnly;
    const isBgDrag = e.target === containerRef.current || e.target.className === 'canvas-grid';

    // In edit mode, if we are not touching empty canvas background, let other events handle it
    if (!isViewOnlyDrag && !isBgDrag && e.touches.length === 1) {
      return;
    }

    e.preventDefault();

    const touchState = touchStateRef.current;
    touchState.isInteracting = true;
    touchState.startPan = { ...pan };
    touchState.startZoom = zoom;

    if (e.touches.length === 1) {
      // Single finger drag to pan
      touchState.touches = [
        { id: e.touches[0].identifier, x: e.touches[0].clientX, y: e.touches[0].clientY }
      ];
    } else if (e.touches.length >= 2) {
      // Two finger pinch to zoom and pan
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchState.touches = [
        { id: t1.identifier, x: t1.clientX, y: t1.clientY },
        { id: t2.identifier, x: t2.clientX, y: t2.clientY }
      ];

      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      touchState.startDistance = Math.hypot(dx, dy);
      touchState.startCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };
    }
  };

  const handleTouchMove = (e) => {
    const touchState = touchStateRef.current;
    if (!touchState.isInteracting) return;

    e.preventDefault();

    if (e.touches.length === 1 && touchState.touches.length === 1) {
      // Single touch pan
      const currentTouch = e.touches[0];
      const startTouch = touchState.touches[0];
      const dx = currentTouch.clientX - startTouch.x;
      const dy = currentTouch.clientY - startTouch.y;

      setPan({
        x: touchState.startPan.x + dx,
        y: touchState.startPan.y + dy
      });
    } else if (e.touches.length >= 2 && touchState.touches.length >= 2) {
      // Two touch pinch and pan
      const t1 = e.touches[0];
      const t2 = e.touches[1];

      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      const currentDistance = Math.hypot(dx, dy);

      const currentCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };

      const factor = currentDistance / touchState.startDistance;
      const newZoom = Math.min(3.0, Math.max(0.15, touchState.startZoom * factor));

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const canvasX = (touchState.startCenter.x - rect.left - touchState.startPan.x) / touchState.startZoom;
        const canvasY = (touchState.startCenter.y - rect.top - touchState.startPan.y) / touchState.startZoom;

        const newPanX = currentCenter.x - rect.left - canvasX * newZoom;
        const newPanY = currentCenter.y - rect.top - canvasY * newZoom;

        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      }
    }
  };

  const handleTouchEnd = (e) => {
    const touchState = touchStateRef.current;
    if (e.touches.length === 0) {
      touchState.isInteracting = false;
      touchState.touches = [];
    } else if (e.touches.length === 1) {
      // Smoothly transition from pinch zoom to single touch panning
      const t = e.touches[0];
      touchState.touches = [
        { id: t.identifier, x: t.clientX, y: t.clientY }
      ];
      touchState.startPan = { ...pan };
    }
  };

  // Keep references to touch handlers up-to-date to avoid stale closures
  const touchHandlersRef = useRef({ handleTouchStart, handleTouchMove, handleTouchEnd });
  useEffect(() => {
    touchHandlersRef.current = { handleTouchStart, handleTouchMove, handleTouchEnd };
  });

  // Attach touch event listeners dynamically
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStartEvent = (e) => {
      if (touchHandlersRef.current) {
        touchHandlersRef.current.handleTouchStart(e);
      }
    };
    const onTouchMoveEvent = (e) => {
      if (touchHandlersRef.current) {
        touchHandlersRef.current.handleTouchMove(e);
      }
    };
    const onTouchEndEvent = (e) => {
      if (touchHandlersRef.current) {
        touchHandlersRef.current.handleTouchEnd(e);
      }
    };

    container.addEventListener('touchstart', onTouchStartEvent, { passive: false });
    container.addEventListener('touchmove', onTouchMoveEvent, { passive: false });
    container.addEventListener('touchend', onTouchEndEvent, { passive: false });
    container.addEventListener('touchcancel', onTouchEndEvent, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStartEvent);
      container.removeEventListener('touchmove', onTouchMoveEvent);
      container.removeEventListener('touchend', onTouchEndEvent);
      container.removeEventListener('touchcancel', onTouchEndEvent);
    };
  }, []);

  // Add standard card note
  const handleAddCard = () => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to add cards.', 'error');
      return;
    }
    const width = 250;
    const height = 180;
    let spawnX = 150;
    let spawnY = 150;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerCoords = screenToCanvas(rect.left + rect.width / 2 - (width * zoom) / 2, rect.top + rect.height / 2 - (height * zoom) / 2);
      spawnX = centerCoords.x;
      spawnY = centerCoords.y;
    }

    const newCard = {
      id: Math.random().toString(36).substring(2, 11),
      x: spawnX,
      y: spawnY,
      width,
      height,
      title: 'Untitled Note',
      content: '',
      tags: [],
      color: 'slate',
      type: 'note',
      cardMode: 'notes',
    };

    setCards((prev) => [...prev, newCard]);
    setSelectedCardId(newCard.id);
    showToast('Card added!');
  };

  // Add image card
  const handleUploadImage = (base64Data) => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to upload images.', 'error');
      return;
    }
    const width = 300;
    const height = 220;
    let spawnX = 150;
    let spawnY = 150;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerCoords = screenToCanvas(rect.left + rect.width / 2 - (width * zoom) / 2, rect.top + rect.height / 2 - (height * zoom) / 2);
      spawnX = centerCoords.x;
      spawnY = centerCoords.y;
    }

    const newImageCard = {
      id: Math.random().toString(36).substring(2, 11),
      x: spawnX,
      y: spawnY,
      width,
      height,
      title: 'Image Note',
      type: 'image',
      imageUrl: base64Data,
      content: '',
      tags: [],
      color: 'slate',
    };

    setCards((prev) => [...prev, newImageCard]);
    setSelectedCardId(newImageCard.id);
    showToast('Image uploaded!');
  };

  // Update card values
  const handleUpdateCard = (cardId, updatedFields) => {
    if (isViewOnly) return;
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, ...updatedFields } : c))
    );
  };

  // Delete card and all its connections
  const handleDeleteCard = (cardId) => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to delete cards.', 'error');
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setConnections((prev) =>
      prev.filter((conn) => conn.fromCardId !== cardId && conn.toCardId !== cardId)
    );
    if (selectedCardId === cardId) setSelectedCardId(null);
    showToast('Card deleted.');
  };

  // Connection Drag-to-Create Mechanics
  const handleStartConnection = (cardId, fromSide, e) => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to connect cards.', 'error');
      return;
    }
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const startPort = getPortCoords(card, fromSide);
    setDraftConnection({
      fromCardId: cardId,
      fromSide,
      start: startPort,
      current: startPort,
    });

    const handleMouseMove = (moveEvent) => {
      const canvasCoords = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
      setDraftConnection((prev) => (prev ? { ...prev, current: canvasCoords } : null));
    };

    const handleMouseUp = (upEvent) => {
      const canvasCoords = screenToCanvas(upEvent.clientX, upEvent.clientY);
      
      const targetCard = cards.find((c) => {
        if (c.id === cardId) return false;
        const w = c.width || 250;
        const h = c.height || 200;
        return (
          canvasCoords.x >= c.x &&
          canvasCoords.x <= c.x + w &&
          canvasCoords.y >= c.y &&
          canvasCoords.y <= c.y + h
        );
      });

      if (targetCard) {
        const targetSide = getClosestSide(targetCard, canvasCoords);
        const exists = connections.some(
          (conn) =>
            (conn.fromCardId === cardId && conn.fromSide === fromSide && conn.toCardId === targetCard.id && conn.toSide === targetSide) ||
            (conn.fromCardId === targetCard.id && conn.fromSide === targetSide && conn.toCardId === cardId && conn.toSide === fromSide)
        );

        if (!exists) {
          const newConnection = {
            id: Math.random().toString(36).substring(2, 9),
            fromCardId: cardId,
            fromSide: fromSide,
            toCardId: targetCard.id,
            toSide: targetSide,
            label: '',
          };
          setConnections((prev) => [...prev, newConnection]);
          showToast('Cards connected!');
        } else {
          showToast('Connection already exists between these ports.', 'error');
        }
      }

      setDraftConnection(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDeleteConnection = (connId) => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to delete connections.', 'error');
      return;
    }
    // Deliberate click action - delete directly for a snappy user experience
    setConnections((prev) => prev.filter((c) => c.id !== connId));
    showToast('Connection line removed.');
  };

  // Helper coordinate getters
  const getPortCoords = (card, side) => {
    const w = card.width || 250;
    const h = card.height || 200;
    switch (side) {
      case 'top': return { x: card.x + w / 2, y: card.y };
      case 'right': return { x: card.x + w, y: card.y + h / 2 };
      case 'bottom': return { x: card.x + w / 2, y: card.y + h };
      case 'left': return { x: card.x, y: card.y + h / 2 };
      default: return { x: card.x + w / 2, y: card.y + h / 2 };
    }
  };

  const getClosestSide = (card, coords) => {
    const w = card.width || 250;
    const h = card.height || 200;
    const ports = [
      { side: 'top', x: card.x + w / 2, y: card.y },
      { side: 'right', x: card.x + w, y: card.y + h / 2 },
      { side: 'bottom', x: card.x + w / 2, y: card.y + h },
      { side: 'left', x: card.x, y: card.y + h / 2 },
    ];
    let minDistance = Infinity;
    let bestSide = 'left';

    ports.forEach((p) => {
      const dist = Math.hypot(p.x - coords.x, p.y - coords.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestSide = p.side;
      }
    });

    return bestSide;
  };

  // Path SVG builder for cubic bezier curves
  const makeCurvePath = (from, to, sideA, sideB) => {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const offset = Math.min(120, Math.max(40, Math.max(dx, dy) * 0.4));

    let cp1 = { x: from.x, y: from.y };
    let cp2 = { x: to.x, y: to.y };

    if (sideA === 'right') cp1.x += offset;
    else if (sideA === 'left') cp1.x -= offset;
    else if (sideA === 'bottom') cp1.y += offset;
    else if (sideA === 'top') cp1.y -= offset;

    if (sideB === 'right') cp2.x += offset;
    else if (sideB === 'left') cp2.x -= offset;
    else if (sideB === 'bottom') cp2.y += offset;
    else if (sideB === 'top') cp2.y -= offset;

    return `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;
  };

  // Convert stroke path points to SVG path format
  const getStrokePathData = (points) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x} ${points[0].y}`;
    return points.reduce((acc, p, idx) => {
      return acc + (idx === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
    }, '');
  };

  // Export board canvas to PNG Image
  const handleExportPNG = async () => {
    if (!containerRef.current) return;
    setSaveStatus('saving');
    
    const boardNameElement = document.querySelector('.modal-input');
    const previousTitle = boardNameElement ? boardNameElement.value : 'board';

    try {
      const toolbar = document.querySelector('.toolbar-container');
      const penPanel = document.querySelector('.pen-settings-panel');
      const saveStatusPanel = document.querySelector('.save-status-indicator');
      const deleteBoardBtn = document.querySelector('.board-card-delete-btn');

      if (toolbar) toolbar.style.display = 'none';
      if (penPanel) penPanel.style.display = 'none';
      if (saveStatusPanel) saveStatusPanel.style.display = 'none';
      if (deleteBoardBtn) deleteBoardBtn.style.display = 'none';

      const dataUrl = await toPng(containerRef.current, {
        backgroundColor: '#0a0a0c',
        quality: 1.0,
      });

      if (toolbar) toolbar.style.display = 'flex';
      if (penPanel) penPanel.style.display = 'flex';
      if (saveStatusPanel) saveStatusPanel.style.display = 'flex';
      if (deleteBoardBtn) deleteBoardBtn.style.display = 'flex';

      const link = document.createElement('a');
      link.download = `${previousTitle.replace(/\s+/g, '_')}_design.png`;
      link.href = dataUrl;
      link.click();
      showToast('Board successfully exported to PNG!');
    } catch (err) {
      console.error(err);
      showToast('Export failed. Check console.', 'error');
    } finally {
      setSaveStatus('saved');
    }
  };

  // Viewport operations
  const handleZoomIn = () => setZoom((z) => Math.min(3.0, z + 0.1));
  const handleZoomOut = () => setZoom((z) => Math.max(0.15, z - 0.1));
  const handleResetZoom = () => {
    setZoom(1.0);
    setPan({ x: 100, y: 100 });
  };

  const handleClearBoard = () => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to clear canvas.', 'error');
      return;
    }
    setCards([]);
    setConnections([]);
    setDrawings([]);
    setSelectedCardId(null);
    showToast('Canvas cleared.');
    setShowClearConfirm(false);
  };

  const handleCanvasClick = (e) => {
    if (e.target === containerRef.current || e.target.className === 'canvas-grid') {
      setSelectedCardId(null);
    }
  };

  const getCardPlainText = (card) => {
    if (card.title?.trim()) return card.title;
    if (card.content) {
      const stripped = card.content.replace(/<[^>]*>/g, '').trim();
      if (stripped) {
        return stripped.length > 35 ? stripped.substring(0, 35) + '...' : stripped;
      }
    }
    return card.type === 'image' ? '🖼️ Image Asset' : '📝 Empty Note';
  };

  const handleFocusOnCard = (card) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;
    
    const cardWidth = card.width || 250;
    const cardHeight = card.height || 180;
    
    const targetZoom = Math.min(
      1.0,
      (viewportWidth * 0.85) / cardWidth,
      (viewportHeight * 0.85) / cardHeight
    );
    const startX = pan.x;
    const startY = pan.y;
    const startZoom = zoom;
    const startTime = performance.now();
    const duration = 400; // ms

    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress < 0.5 
        ? 2 * progress * progress 
        : -1 + (4 - 2 * progress) * progress;

      // Animate zoom scale dynamically
      const currentZoom = startZoom + (targetZoom - startZoom) * ease;
      setZoom(currentZoom);

      // Recalculate dynamic target pan coordinates to keep centering aligned during zooming
      const currentTargetX = viewportWidth / 2 - (card.x + cardWidth / 2) * currentZoom;
      const currentTargetY = viewportHeight / 2 - (card.y + cardHeight / 2) * currentZoom;

      setPan({
        x: startX + (currentTargetX - startX) * ease,
        y: startY + (currentTargetY - startY) * ease
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setSelectedCardId(card.id);
        setBlinkingCardId(card.id);
        setTimeout(() => {
          setBlinkingCardId(null);
        }, 1500);
      }
    };

    requestAnimationFrame(animate);
  };

  const handleBirdsEyeView = () => {
    if (!containerRef.current) return;
    if (cards.length === 0) {
      // If empty, reset smoothly to zoom 1.0 and pan 100, 100
      const startX = pan.x;
      const startY = pan.y;
      const startZoom = zoom;
      const startTime = performance.now();
      const duration = 400;
      const animate = (time) => {
        const elapsed = time - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        setZoom(startZoom + (1.0 - startZoom) * ease);
        setPan({
          x: startX + (100 - startX) * ease,
          y: startY + (100 - startY) * ease
        });
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    cards.forEach((card) => {
      const cardWidth = card.width || 250;
      const cardHeight = card.height || 180;
      minX = Math.min(minX, card.x);
      minY = Math.min(minY, card.y);
      maxX = Math.max(maxX, card.x + cardWidth);
      maxY = Math.max(maxY, card.y + cardHeight);
    });

    const padding = 80;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const targetZoom = Math.min(
      1.0,
      Math.max(0.15, Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight))
    );

    const startX = pan.x;
    const startY = pan.y;
    const startZoom = zoom;
    const startTime = performance.now();
    const duration = 400; // ms

    const animate = (time) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const ease = progress < 0.5 
        ? 2 * progress * progress 
        : -1 + (4 - 2 * progress) * progress;

      const currentZoom = startZoom + (targetZoom - startZoom) * ease;
      setZoom(currentZoom);

      const currentTargetX = viewportWidth / 2 - (minX + contentWidth / 2) * currentZoom;
      const currentTargetY = viewportHeight / 2 - (minY + contentHeight / 2) * currentZoom;

      setPan({
        x: startX + (currentTargetX - startX) * ease,
        y: startY + (currentTargetY - startY) * ease
      });

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  };

  const handleUnlockEditing = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/boards/${boardId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: unlockPassInput }),
      });
      if (!res.ok) throw new Error('Password verification failed');
      const data = await res.json();
      if (data.success) {
        showToast('Editing unlocked.');
        const passToUse = data.hashedPassword || unlockPassInput;
        localStorage.setItem(`dragg-board-pass-${boardId}`, passToUse);
        setLocalPassword(passToUse);
        onUpdatePassword(passToUse);
        setShowUnlockModal(false);
        setUnlockPassInput('');
      } else {
        showToast('Incorrect password.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error validating password.', 'error');
    }
  };

  const handleRunBoardCode = async () => {
    const selectedLang = LANGUAGES.find(l => l.id === boardLanguage) || LANGUAGES[0];
    
    setIsCodeRunning(true);
    setCodeOutput('Executing code on secure runtime container...');
    setCodeError(false);

    try {
      const res = await fetch('https://emkc.org/api/v2/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: selectedLang.id,
          version: selectedLang.version,
          files: [
            {
              name: `main.${selectedLang.ext}`,
              content: boardCode || ''
            }
          ]
        })
      });

      if (!res.ok) throw new Error('Runtime error connecting to execution container');
      const data = await res.json();
      
      if (data.run) {
        const stdout = data.run.stdout || '';
        const stderr = data.run.stderr || '';
        const code = data.run.code;

        if (stderr) {
          setCodeOutput(stderr);
          setCodeError(true);
        } else if (stdout) {
          setCodeOutput(stdout);
          setCodeError(false);
        } else {
          setCodeOutput(`Process finished with exit code ${code} (No output produced)`);
          setCodeError(false);
        }
      } else {
        setCodeOutput('Could not run code: Invalid API response format.');
        setCodeError(true);
      }
    } catch (err) {
      console.error(err);
      if (selectedLang.id === 'javascript') {
        setCodeOutput('Secure container unreachable. Running code in local browser sandbox...\n');
        try {
          const logs = [];
          const originalLog = console.log;
          const originalError = console.error;
          
          console.log = (...args) => {
            logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
          };
          console.error = (...args) => {
            logs.push('[Error] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
          };

          const runFn = new Function(boardCode || '');
          runFn();

          console.log = originalLog;
          console.error = originalError;

          setCodeOutput(logs.join('\n') || '(No output produced)');
          setCodeError(false);
        } catch (jsErr) {
          setCodeOutput(`Local Execution Error: ${jsErr.message}`);
          setCodeError(true);
        }
      } else {
        setCodeOutput(`Execution Error: ${err.message}`);
        setCodeError(true);
      }
    } finally {
      setIsCodeRunning(false);
    }
  };

  const activeToolClass = (toolMode === 'pen' || toolMode === 'ruler') ? 'tool-pen' : '';

  const filteredCards = cards.filter((card) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = card.title?.toLowerCase().includes(query);
    const contentPlain = card.content ? card.content.replace(/<[^>]*>/g, '').toLowerCase() : '';
    const contentMatch = contentPlain.includes(query);
    return titleMatch || contentMatch;
  });

  return (
    <div className={`board-workspace-wrapper ${isCodePanelOpen ? 'split-screen-active' : ''}`} style={{ display: 'flex', width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      
      <div 
        ref={containerRef}
        className={`canvas-container ${activeToolClass} ${isViewOnly ? 'view-only-canvas' : ''}`}
        onMouseDown={handleContainerMouseDown}
        onClick={handleCanvasClick}
        style={{ flex: 1, position: 'relative', height: '100%' }}
      >
      {/* Background Minimal Grid */}
      {gridVisible && (
        <div 
          className="canvas-grid"
          style={{
            backgroundSize: `${40 * zoom}px ${40 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />
      )}

      {/* Floating Canvas Outline Popup Overlay */}
      {isOutlineOpen && (
        <div 
          className="outline-sidebar-panel glass"
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          style={{ 
            position: 'absolute',
            top: '5.5rem',
            left: '1.5rem',
            width: '320px', 
            maxHeight: 'calc(100% - 8rem)', 
            display: 'flex', 
            flexDirection: 'column', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            background: 'rgba(10, 10, 15, 0.85)', 
            borderRadius: '16px',
            zIndex: 1001, 
            overflow: 'hidden',
            padding: '1.2rem',
            boxSizing: 'border-box',
            gap: '1rem',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <List size={16} color="var(--accent-cyan)" />
              Canvas Outline
            </h3>
            <button 
              onClick={() => setIsOutlineOpen(false)}
              className="board-card-delete-btn glass"
              style={{ padding: '0.3rem', borderRadius: '8px' }}
              title="Close Outline"
            >
              <X size={14} />
            </button>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.8rem 0.5rem 2rem',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '0.85rem',
                boxSizing: 'border-box'
              }}
            />
            <Search size={14} color="var(--color-text-muted)" style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)' }} />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                ×
              </button>
            )}
          </div>

          {/* Topics List */}
          <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '0.2rem' }}>
            {filteredCards.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                {cards.length === 0 ? 'No topics created on canvas yet.' : 'No matching topics found.'}
              </div>
            ) : (
              filteredCards.map((card) => {
                const isActive = selectedCardId === card.id;
                const text = getCardPlainText(card);
                return (
                  <div
                    key={card.id}
                    onClick={() => handleFocusOnCard(card)}
                    style={{
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      background: isActive ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: isActive ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.04)',
                      color: isActive ? '#cffafe' : 'var(--color-text-main)',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 600 : 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    }}
                    title={`Focus on: ${text}`}
                  >
                    <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>
                      {card.type === 'image' ? '🖼️' : '📝'}
                    </span>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flexGrow: 1 }}>
                      {text}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Canvas Header */}
      {!isFullscreen && (
        <div 
          className="glass canvas-header"
          style={{
            position: 'fixed',
            top: '1.5rem',
            left: '1.5rem',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '1.2rem',
            padding: '0.6rem 1.2rem',
            borderRadius: '16px',
            background: 'rgba(10, 10, 15, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          }}
        >
        <button 
          className="board-card-delete-btn glass"
          style={{ padding: '0.6rem', borderRadius: '12px' }}
          onClick={onBack}
          title="Back to Dashboard"
        >
          <ArrowLeft size={16} />
        </button>

        <button 
          className={`board-card-delete-btn glass ${isOutlineOpen ? 'active' : ''}`}
          style={{ 
            padding: '0.6rem 0.9rem', 
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: isOutlineOpen ? 'rgba(6, 182, 212, 0.2)' : 'rgba(18, 18, 24, 0.4)',
            border: isOutlineOpen ? '1px solid var(--accent-cyan)' : '1px solid rgba(255, 255, 255, 0.05)',
            color: isOutlineOpen ? '#cffafe' : 'var(--color-text-main)'
          }}
          onClick={() => {
            const next = !isOutlineOpen;
            setIsOutlineOpen(next);
            if (next) setIsCodePanelOpen(false);
          }}
          title="Toggle Canvas Outline"
        >
          <List size={15} />
          <span className="header-btn-text" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Outline</span>
        </button>

        <button 
          className="board-card-delete-btn glass"
          style={{ 
            padding: '0.6rem 0.9rem', 
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(18, 18, 24, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            color: 'var(--color-text-main)'
          }}
          onClick={handleBirdsEyeView}
          title="Bird's Eye View (Zoom Out to Fit All Cards)"
        >
          <Compass size={15} />
          <span className="header-btn-text" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Bird's Eye</span>
        </button>

        <button 
          className={`board-card-delete-btn glass ${isCodePanelOpen ? 'active' : ''}`}
          style={{ 
            padding: '0.6rem 0.9rem', 
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: isCodePanelOpen ? 'rgba(99, 102, 241, 0.2)' : 'rgba(18, 18, 24, 0.4)',
            border: isCodePanelOpen ? '1px solid var(--accent-indigo)' : '1px solid rgba(255, 255, 255, 0.05)',
            color: isCodePanelOpen ? '#a5b4fc' : 'var(--color-text-main)'
          }}
          onClick={() => {
            const next = !isCodePanelOpen;
            setIsCodePanelOpen(next);
            if (next) setIsOutlineOpen(false);
          }}
          title="Toggle Code Sandbox Panel"
        >
          <Code2 size={15} />
          <span className="header-btn-text" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Sandbox</span>
        </button>

        <button 
          className="board-card-delete-btn glass"
          style={{ 
            padding: '0.6rem 0.9rem', 
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(18, 18, 24, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            color: 'var(--color-text-main)'
          }}
          onClick={handleToggleFullscreen}
          title="Enter Fullscreen"
        >
          <Maximize2 size={15} />
          <span className="header-btn-text" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Fullscreen</span>
        </button>

        <input 
          type="text"
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          className="modal-input canvas-title-input"
          readOnly={isViewOnly}
          style={{
            fontSize: '1.2rem',
            fontWeight: 700,
            background: 'rgba(18, 18, 24, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            padding: '0.5rem 1rem',
            fontFamily: 'var(--font-heading)',
          }}
          title={isViewOnly ? 'Board is locked' : 'Click to rename Board'}
        />

        {protectionMode !== 'none' && (
          isViewOnly ? (
            <button
              className="board-card-delete-btn glass"
              style={{
                padding: '0.5rem 0.8rem',
                borderRadius: '12px',
                fontSize: '0.8rem',
                color: 'var(--accent-rose)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                cursor: 'pointer'
              }}
              onClick={() => {
                setShowUnlockModal(true);
                setUnlockPassInput('');
              }}
              title="Board is locked for editing. Click to unlock."
            >
              <Lock size={12} color="var(--accent-rose)" />
              <span className="header-btn-text">View Mode</span>
            </button>
          ) : (
            <div
              className="glass"
              style={{
                padding: '0.5rem 0.8rem',
                borderRadius: '12px',
                fontSize: '0.8rem',
                color: 'var(--accent-emerald)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                userSelect: 'none'
              }}
              title="Editing is unlocked."
            >
              <Unlock size={12} color="var(--accent-emerald)" />
              <span className="header-btn-text">Edit Mode</span>
            </div>
          )
        )}
      </div>
    )}

    {isFullscreen && (
      <button
        onClick={handleToggleFullscreen}
        className="board-card-delete-btn glass"
        style={{
          position: 'fixed',
          top: '1.5rem',
          right: '1.5rem',
          zIndex: 1000,
          padding: '0.6rem 1.2rem',
          borderRadius: '16px',
          background: 'rgba(10, 10, 15, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'white',
          fontWeight: 600,
          fontSize: '0.85rem',
          cursor: 'pointer',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        }}
      >
        <Minimize2 size={16} />
        <span>Exit Fullscreen</span>
      </button>
    )}

      {/* Save Status Indicators & Manual Save Button */}
      {!isViewOnly && (
        <div 
          className={`save-status-indicator glass ${shouldGlowAlert ? 'alert-glow' : ''}`} 
          style={{ 
            gap: '0.8rem', 
            padding: '0.4rem 0.8rem',
            border: shouldGlowAlert ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div className={`save-dot ${getSaveDotClass()}`} />
            <span 
              style={{ 
                color: shouldGlowAlert ? 'var(--accent-rose)' : 'var(--color-text-muted)', 
                fontSize: '0.8rem',
                fontWeight: shouldGlowAlert ? 600 : 500
              }}
            >
              {getSaveStatusLabel()}
            </span>
          </div>

          <button
            onClick={() => handleSaveBoard(true)}
            style={{
              background: shouldGlowAlert ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: shouldGlowAlert ? '1px solid rgba(244, 63, 94, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '0.25rem 0.6rem',
              color: shouldGlowAlert ? '#fecdd3' : 'var(--color-text-main)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              transition: 'background 0.2s',
            }}
            title="Save changes manually"
            className="manual-save-btn"
          >
            Save
          </button>
        </div>
      )}

      {/* Zoom and Coordinate Translated Workspace Layer */}
      <div 
        className="canvas-content"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* SVG Drawing Layer for connections and pen sketches */}
        <svg className="connections-svg">
          {/* RENDER DRAWINGS STROKES */}
          {drawings.map((stroke, idx) => (
            <path
              key={`stroke-${idx}`}
              d={getStrokePathData(stroke.points)}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.thickness}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* RENDER ACTIVE STROKE IN PROGRESS */}
          {activeStroke && (
            <path
              d={getStrokePathData(activeStroke.points)}
              fill="none"
              stroke={activeStroke.color}
              strokeWidth={activeStroke.thickness}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* SVG GRADIENTS DEFINITION */}
          <defs>
            {connections.map((conn) => {
              const cardA = cards.find((c) => c.id === conn.fromCardId);
              const cardB = cards.find((c) => c.id === conn.toCardId);
              if (!cardA || !cardB) return null;

              const accentColors = {
                slate: '#64748b',
                indigo: '#6366f1',
                cyan: '#06b6d4',
                emerald: '#10b981',
                amber: '#f59e0b',
                rose: '#f43f5e',
              };

              const colorA = accentColors[cardA.color || 'slate'];
              const colorB = accentColors[cardB.color || 'slate'];

              return (
                <linearGradient key={`grad-${conn.id}`} id={`grad-${conn.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={colorA} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={colorB} stopOpacity="0.8" />
                </linearGradient>
              );
            })}
          </defs>

          {/* RENDER CONNECTIONS */}
          {connections.map((conn) => {
            const cardA = cards.find((c) => c.id === conn.fromCardId);
            const cardB = cards.find((c) => c.id === conn.toCardId);
            if (!cardA || !cardB) return null;

            const fromSide = conn.fromSide || 'right';
            const toSide = conn.toSide || 'left';

            const from = getPortCoords(cardA, fromSide);
            const to = getPortCoords(cardB, toSide);
            const dStr = makeCurvePath(from, to, fromSide, toSide);

            return (
              <g key={conn.id}>
                <path
                  d={dStr}
                  className="connection-line"
                  stroke={`url(#grad-${conn.id})`}
                  onClick={() => handleDeleteConnection(conn.id)}
                  title="Double click to delete connection"
                />
              </g>
            );
          })}

          {/* Render Active Connection Draft Line */}
          {draftConnection && (
            <path
              d={makeCurvePath(
                draftConnection.start,
                draftConnection.current,
                draftConnection.fromSide,
                'center'
              )}
              className="connection-draft"
            />
          )}
        </svg>

        {/* DOM Cards rendering Layer */}
        <div className="canvas-elements-layer">
          {cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              isSelected={selectedCardId === card.id}
              onSelect={setSelectedCardId}
              onUpdate={handleUpdateCard}
              onDelete={handleDeleteCard}
              zoom={zoom}
              onStartConnection={handleStartConnection}
              toolMode={isViewOnly ? 'select' : toolMode}
              isViewOnly={isViewOnly}
              isBlinking={blinkingCardId === card.id}
              onDoubleClickFocus={handleFocusOnCard}
            />
          ))}
        </div>
      </div>

      {/* Floating Canvas Toolbar controls */}
      {!isViewOnly && (
        <Toolbar
          onAddCard={handleAddCard}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onToggleGrid={() => setGridVisible(!gridVisible)}
          gridVisible={gridVisible}
          onClearBoard={() => setShowClearConfirm(true)}
          onBack={onBack}
          zoom={zoom}
          toolMode={toolMode}
          onChangeToolMode={setToolMode}
          onUploadImage={handleUploadImage}
          onExportPNG={handleExportPNG}
          penColor={penColor}
          onChangePenColor={setPenColor}
          penThickness={penThickness}
          onChangePenThickness={setPenThickness}
          isViewOnly={isViewOnly}
        />
      )}

      {/* Custom Clear Canvas Confirmation Modal */}
      {showClearConfirm && (
        <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
          <div 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title" style={{ color: 'var(--accent-rose)' }}>Wipe Canvas Clean?</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.4' }}>
              Are you sure you want to clear the entire whiteboard?<br/>
              This will permanently delete all cards, images, drawings, and connection lines on this board.
            </p>
            <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                style={{ background: 'var(--accent-rose)', boxShadow: '0 4px 14px rgba(244, 63, 94, 0.3)' }}
                onClick={handleClearBoard}
              >
                Wipe Clean
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlock Board Modal */}
      {showUnlockModal && (
        <div className="modal-overlay" onClick={() => {
          setShowUnlockModal(false);
          setUnlockPassInput('');
        }}>
          <form 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleUnlockEditing}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
          >
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={20} color="var(--accent-rose)" /> Unlock Editing
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
              This board is partially locked. Please enter the password to authorize whiteboard modifications.
            </p>
            <input 
              type="password" 
              className="modal-input" 
              placeholder="Enter password..." 
              value={unlockPassInput}
              onChange={(e) => setUnlockPassInput(e.target.value)}
              autoFocus
              required
            />
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockPassInput('');
                }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ background: 'var(--accent-indigo)' }}
              >
                Unlock Edits
              </button>
            </div>
          </form>
        </div>
      )}
    </div>

    {/* Code Split Panel */}
    {isCodePanelOpen && (
      <div 
        className="code-split-panel glass" 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          width: '450px', 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)', 
          background: 'rgba(10, 10, 15, 0.95)', 
          zIndex: 1001, 
          overflow: 'hidden',
          padding: '1.2rem',
          boxSizing: 'border-box',
          gap: '1rem',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Code2 size={16} color="var(--accent-indigo)" />
            Code Sandbox
          </h3>
          <button 
            onClick={() => setIsCodePanelOpen(false)}
            className="board-card-delete-btn glass"
            style={{ padding: '0.3rem', borderRadius: '8px' }}
            title="Close Panel"
          >
            <X size={14} />
          </button>
        </div>

        {/* Sandbox controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
          <select
            className="card-language-select"
            value={boardLanguage}
            onChange={(e) => setBoardLanguage(e.target.value)}
            style={{ flexGrow: 1, padding: '0.4rem', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
          
          <button
            type="button"
            className={`card-run-btn ${isCodeRunning ? 'running' : ''}`}
            onClick={handleRunBoardCode}
            disabled={isCodeRunning || isViewOnly}
            style={{
              background: 'var(--accent-indigo)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.4rem 0.8rem',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem'
            }}
            title={isViewOnly ? "Sandbox disabled in view-only mode" : "Execute code"}
          >
            <Play size={11} style={{ verticalAlign: 'middle' }} />
            {isCodeRunning ? 'Running...' : 'Run'}
          </button>
        </div>

        {/* Editor TextArea */}
        <div style={{ flexGrow: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <textarea
            className="card-code-textarea"
            value={boardCode}
            onChange={(e) => setBoardCode(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Tab') {
                e.preventDefault();
                const textarea = e.target;
                const { selectionStart, selectionEnd, value } = textarea;
                const newValue = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd);
                setBoardCode(newValue);
                setTimeout(() => {
                  textarea.selectionStart = textarea.selectionEnd = selectionStart + 2;
                }, 0);
              }
            }}
            placeholder={getPlaceholderForLang(boardLanguage)}
            style={{ 
              flexGrow: 1, 
              width: '100%', 
              fontFamily: 'Courier New, monospace', 
              fontSize: '0.85rem', 
              background: 'rgba(0,0,0,0.4)', 
              border: '1px solid rgba(255,255,255,0.08)', 
              borderRadius: '8px', 
              color: '#e4e4e7', 
              padding: '0.8rem',
              resize: 'none'
            }}
            readOnly={isViewOnly}
          />
        </div>

        {/* Console Area */}
        {codeOutput && (
          <div style={{ height: '160px', display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Console Output</span>
              <button 
                onClick={() => setCodeOutput('')}
                style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', fontSize: '0.7rem', cursor: 'pointer' }}
              >
                Clear
              </button>
            </div>
            <pre style={{ flexGrow: 1, margin: 0, padding: '0.6rem', overflowY: 'auto', fontFamily: 'Courier New, monospace', fontSize: '0.8rem', color: codeError ? '#f43f5e' : '#10b981', whiteSpace: 'pre-wrap' }}>
              {codeOutput}
            </pre>
          </div>
        )}
      </div>
    )}
  </div>
);
}

export default CanvasBoard;
