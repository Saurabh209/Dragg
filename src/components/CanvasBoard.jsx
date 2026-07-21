import React, { useState, useEffect, useRef } from 'react';
import Card, { LANGUAGES, getPlaceholderForLang } from './Card';
import Toolbar from './Toolbar';
import LiveCanvasBackground from './LiveCanvasBackground';
import { ArrowLeft, Lock, Unlock, Eye, Code2, X, Play, List, Search, Compass, Maximize2, Minimize2, Save, Copy, Target, Type, Image as ImageIcon, Plus, Trash2, Move } from 'lucide-react';
import { toPng } from 'html-to-image';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function CanvasBoard({ boardId, boardPassword, onUpdatePassword, onBack, showToast, forceViewOnly = false }) {
  const [boardName, setBoardName] = useState('');
  const [cards, setCards] = useState([]);
  const [connections, setConnections] = useState([]);
  const [drawings, setDrawings] = useState([]); // Array of strokes: { tool, color, thickness, points }
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [zoom, setZoom] = useState(1.0);
  const [gridType, setGridType] = useState(() => {
    const saved = localStorage.getItem('dragg-grid-type');
    return saved || 'dots';
  });
  const [boardBgColor, setBoardBgColor] = useState(() => {
    return localStorage.getItem('dragg-board-bg') || '#0a0a0c';
  });
  const [cursorStyle, setCursorStyle] = useState(() => {
    return localStorage.getItem('dragg-cursor-style') || 'default';
  });
  const [liveBgStyle, setLiveBgStyle] = useState(() => {
    return localStorage.getItem('dragg-live-bg') || 'none';
  });

  // Multi-card selection states
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const selectedCardId = selectedCardIds[0] || null;
  const setSelectedCardId = (id) => setSelectedCardIds(id ? [id] : []);

  useEffect(() => {
    localStorage.setItem('dragg-grid-type', gridType);
  }, [gridType]);

  useEffect(() => {
    localStorage.setItem('dragg-board-bg', boardBgColor);
  }, [boardBgColor]);

  useEffect(() => {
    localStorage.setItem('dragg-cursor-style', cursorStyle);
  }, [cursorStyle]);

  useEffect(() => {
    localStorage.setItem('dragg-live-bg', liveBgStyle);
  }, [liveBgStyle]);
  
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

  // Auto-Save setting (persisted in localStorage, defaults to 2 mins)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
    const saved = localStorage.getItem('dragg-autosave-enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('dragg-autosave-enabled', JSON.stringify(autoSaveEnabled));
  }, [autoSaveEnabled]);

  // For connection creation
  const [draftConnection, setDraftConnection] = useState(null);

  // Custom clear board confirmation modal state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  // Global Code Sandbox state
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(false);
  const [boardCode, setBoardCode] = useState('');
  const [boardLanguage, setBoardLanguage] = useState('javascript');
  const [isCodeRunning, setIsCodeRunning] = useState(false);
  const [codeOutput, setCodeOutput] = useState('');
  const [codeError, setCodeError] = useState(false);
  // Code Sandbox resizable panel state
  const [codePanelWidth, setCodePanelWidth] = useState(() => {
    const saved = localStorage.getItem('dragg-sandbox-width');
    return saved ? parseInt(saved, 10) : 450;
  });
  const [isResizingSandbox, setIsResizingSandbox] = useState(false);

  // Custom Right Click Context Menu state
  const [contextMenu, setContextMenu] = useState(null);

  // Close context menu on global click or Escape key
  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
      }
      if (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.hasAttribute('contenteditable') ||
        document.activeElement.closest('[contenteditable]')
      ) {
        return;
      }
      if (e.key.toLowerCase() === 'm') {
        setToolMode('box-select');
        showToast('Multi-Select Marquee Tool Active');
      } else if (e.key.toLowerCase() === 'v') {
        setToolMode('select');
        showToast('Select & Pan Tool Active');
      }
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const cardWrapper = e.target.closest('.card-wrapper');
    let targetCardId = null;
    if (cardWrapper) {
      const cardIdAttr = cardWrapper.getAttribute('data-card-id');
      if (cardIdAttr) {
        targetCardId = cardIdAttr;
        if (!selectedCardIds.includes(targetCardId)) {
          setSelectedCardIds([targetCardId]);
        }
      }
    }

    const menuWidth = 230;
    const menuHeight = (targetCardId || selectedCardIds.length > 1) ? 330 : 260;
    
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth - 12) {
      x = window.innerWidth - menuWidth - 12;
    }
    if (x < 12) x = 12;

    if (y + menuHeight > window.innerHeight - 12) {
      y = window.innerHeight - menuHeight - 12;
    }
    if (y < 12) y = 12;

    setContextMenu({
      x,
      y,
      cardId: targetCardId
    });
  };

  const handleSelectCard = (cardId, e) => {
    if (e && (e.shiftKey || e.metaKey || e.ctrlKey)) {
      setSelectedCardIds((prev) => 
        prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
      );
    } else {
      if (!selectedCardIds.includes(cardId)) {
        setSelectedCardIds([cardId]);
      }
    }
  };

  // Calculate bounding box for multi-selected cards group container
  const selectedCards = cards.filter((c) => selectedCardIds.includes(c.id));
  let groupBoundingBox = null;

  if (selectedCards.length > 1) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedCards.forEach((c) => {
      const w = c.width || 250;
      const h = c.height || 200;
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x + w > maxX) maxX = c.x + w;
      if (c.y + h > maxY) maxY = c.y + h;
    });

    const padding = 12;
    groupBoundingBox = {
      x: minX - padding,
      y: minY - padding,
      width: (maxX - minX) + padding * 2,
      height: (maxY - minY) + padding * 2,
      cardCount: selectedCards.length
    };
  }

  // Handle dragging the group selection container box from anywhere inside it
  const handleGroupDragMouseDown = (e) => {
    if (isViewOnly || e.button !== 0) return;
    if (
      e.target.tagName === 'INPUT' || 
      e.target.tagName === 'TEXTAREA' || 
      e.target.tagName === 'CANVAS' ||
      e.target.closest('.card-content-textarea') ||
      e.target.closest('[contenteditable]') ||
      e.target.closest('.card-tab-btn') ||
      e.target.closest('.card-action-btn')
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const clientStartX = e.clientX;
    const clientStartY = e.clientY;

    const initialPositions = new Map();
    selectedCards.forEach((c) => initialPositions.set(c.id, { x: c.x, y: c.y }));

    const handleMouseMove = (moveEvent) => {
      const dx = (moveEvent.clientX - clientStartX) / zoom;
      const dy = (moveEvent.clientY - clientStartY) / zoom;

      setCards((prev) =>
        prev.map((c) => {
          if (initialPositions.has(c.id)) {
            const init = initialPositions.get(c.id);
            return { ...c, x: init.x + dx, y: init.y + dy };
          }
          return c;
        })
      );
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleDuplicateCard = (cardId) => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to duplicate cards.', 'error');
      return;
    }
    const targetIds = (selectedCardIds.includes(cardId) && selectedCardIds.length > 1) 
      ? selectedCardIds 
      : [cardId];

    const newCards = [];
    const newSelectedIds = [];

    targetIds.forEach((id) => {
      const card = cards.find((c) => c.id === id);
      if (!card) return;

      let baseTitle = (card.title || 'Untitled Note').trim();
      const copyMatch = baseTitle.match(/^(.*?)\s*\(Copy(?:\s+(\d+))?\)$/i);
      let nextCount = 1;

      if (copyMatch) {
        baseTitle = copyMatch[1].trim();
        const currentNum = copyMatch[2] ? parseInt(copyMatch[2], 10) : 1;
        nextCount = currentNum + 1;
      }

      const newTitle = nextCount === 1 ? `${baseTitle} (Copy)` : `${baseTitle} (Copy ${nextCount})`;
      const newId = Math.random().toString(36).substring(2, 11);

      newCards.push({
        ...JSON.parse(JSON.stringify(card)),
        id: newId,
        x: card.x + 35,
        y: card.y + 35,
        title: newTitle
      });

      newSelectedIds.push(newId);
    });

    if (newCards.length > 0) {
      setCards((prev) => [...prev, ...newCards]);
      setSelectedCardIds(newSelectedIds);
      showToast(`${newCards.length > 1 ? `${newCards.length} cards` : 'Card'} duplicated!`);
    }
  };

  useEffect(() => {
    localStorage.setItem('dragg-sandbox-width', codePanelWidth);
  }, [codePanelWidth]);

  const handleSandboxResizeMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingSandbox(true);

    const handleMouseMove = (moveEvent) => {
      const newWidth = window.innerWidth - moveEvent.clientX;
      const clampedWidth = Math.max(300, Math.min(window.innerWidth - 200, newWidth));
      setCodePanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingSandbox(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Canvas Outline Sidebar state
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [blinkingCardId, setBlinkingCardId] = useState(null);

  // Card customization modal state
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [cardFeatures, setCardFeatures] = useState({
    notes: true,
    sketch: true,
    attachments: true,
    tags: true,
    colorPalette: true,
    completedStatus: true,
    connectPorts: true
  });

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
      selectMode: { key: 'v', code: 'KeyV', label: 'Select & Pan Mode' },
      boxSelectMode: { key: 'm', code: 'KeyM', label: 'Multi-Select Mode' },
      connectorMode: { key: 'c', code: 'KeyC', label: 'Connector Mode' },
      eraserMode: { key: 'e', code: 'KeyE', label: 'Eraser Mode' },
    };
  });

  const containerRef = useRef(null);
  const justSelectedRef = useRef(false);
  const lineNumbersRef = useRef(null);
  const isPanningRef = useRef(false);
  const saveTimeoutRef = useRef(null);
  const isInitialLoad = useRef(true);
  const lastSavedStateRef = useRef(null);

  // VS Code Smart Editor keyboard logic (auto-close brackets, auto-indent, tab/shift-tab)
  const handleEditorKeyDown = (e) => {
    e.stopPropagation();
    if (isViewOnly) return;

    const textarea = e.target;
    const { selectionStart, selectionEnd, value } = textarea;
    const pairs = {
      '(': ')',
      '{': '}',
      '[': ']',
      '"': '"',
      "'": "'",
      '`': '`'
    };

    // 1. Auto-closing brackets and quotes
    if (pairs[e.key]) {
      e.preventDefault();
      const openChar = e.key;
      const closeChar = pairs[e.key];

      if (selectionStart !== selectionEnd) {
        // Selection wrapping: e.g. "selected text" or {selected text}
        const selectedText = value.substring(selectionStart, selectionEnd);
        const newValue = value.substring(0, selectionStart) + openChar + selectedText + closeChar + value.substring(selectionEnd);
        setBoardCode(newValue);
        setTimeout(() => {
          textarea.selectionStart = selectionStart + 1;
          textarea.selectionEnd = selectionEnd + 1;
        }, 0);
      } else {
        // Skip duplicate closing char if typed right before existing matching char
        const nextChar = value[selectionStart];
        if ((openChar === '"' || openChar === "'" || openChar === '`') && nextChar === openChar) {
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
          }, 0);
          return;
        }

        const newValue = value.substring(0, selectionStart) + openChar + closeChar + value.substring(selectionEnd);
        setBoardCode(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
        }, 0);
      }
      return;
    }

    // Over-type existing closing bracket/quote if cursor is right before it
    const closingChars = [')', '}', ']', '"', "'", '`'];
    if (closingChars.includes(e.key) && selectionStart === selectionEnd && value[selectionStart] === e.key) {
      e.preventDefault();
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = selectionStart + 1;
      }, 0);
      return;
    }

    // 2. Smart Backspace for empty pairs e.g. (|) or {|} or [|] or "" or ''
    if (e.key === 'Backspace' && selectionStart === selectionEnd && selectionStart > 0) {
      const charBefore = value[selectionStart - 1];
      const charAfter = value[selectionStart];
      if (pairs[charBefore] && pairs[charBefore] === charAfter) {
        e.preventDefault();
        const newValue = value.substring(0, selectionStart - 1) + value.substring(selectionStart + 1);
        setBoardCode(newValue);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart - 1;
        }, 0);
        return;
      }
    }

    // 3. Smart Enter (\n) with Auto Indentation and block expansion
    if (e.key === 'Enter') {
      e.preventDefault();
      const lastLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = value.substring(lastLineStart, selectionStart);
      
      const indentMatch = currentLine.match(/^[\t ]*/);
      let currentIndent = indentMatch ? indentMatch[0] : '';
      
      const charBefore = value[selectionStart - 1];
      const charAfter = value[selectionStart];

      // If pressing Enter between { and } or ( and ) or [ and ]
      if (pairs[charBefore] && pairs[charBefore] === charAfter) {
        const extraIndent = '  ';
        const newValue = value.substring(0, selectionStart) + '\n' + currentIndent + extraIndent + '\n' + currentIndent + value.substring(selectionEnd);
        setBoardCode(newValue);
        setTimeout(() => {
          const cursorPosition = selectionStart + 1 + currentIndent.length + extraIndent.length;
          textarea.selectionStart = textarea.selectionEnd = cursorPosition;
        }, 0);
        return;
      }

      // If line ends with opening bracket, colon, or arrow function, increase indent
      const isBlockStart = ['{', '(', '[', ':', '->', '=>'].some(symbol => currentLine.trim().endsWith(symbol));
      if (isBlockStart) {
        currentIndent += '  ';
      }

      const newValue = value.substring(0, selectionStart) + '\n' + currentIndent + value.substring(selectionEnd);
      setBoardCode(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = selectionStart + 1 + currentIndent.length;
      }, 0);
      return;
    }

    // 4. Tab & Shift+Tab Indentation / Outdentation
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+Tab: Outdent current line or selected block
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        const lineEnd = value.indexOf('\n', selectionEnd);
        const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
        const selectedText = value.substring(lineStart, actualLineEnd);
        
        const unindentedText = selectedText
          .split('\n')
          .map(line => line.startsWith('  ') ? line.substring(2) : line.startsWith('\t') ? line.substring(1) : line)
          .join('\n');

        const newValue = value.substring(0, lineStart) + unindentedText + value.substring(actualLineEnd);
        setBoardCode(newValue);
        setTimeout(() => {
          textarea.selectionStart = Math.max(lineStart, selectionStart - 2);
          textarea.selectionEnd = Math.max(lineStart, selectionEnd - (selectedText.length - unindentedText.length));
        }, 0);
      } else {
        if (selectionStart !== selectionEnd) {
          // Tab on selected multi-line block
          const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
          const lineEnd = value.indexOf('\n', selectionEnd);
          const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
          const selectedText = value.substring(lineStart, actualLineEnd);

          const indentedText = selectedText
            .split('\n')
            .map(line => '  ' + line)
            .join('\n');

          const newValue = value.substring(0, lineStart) + indentedText + value.substring(actualLineEnd);
          setBoardCode(newValue);
          setTimeout(() => {
            textarea.selectionStart = selectionStart + 2;
            textarea.selectionEnd = selectionEnd + (indentedText.length - selectedText.length);
          }, 0);
        } else {
          // Single Tab at cursor
          const newValue = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd);
          setBoardCode(newValue);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selectionStart + 2;
          }, 0);
        }
      }
      return;
    }
  };

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

        lastSavedStateRef.current = {
          boardName: data.name || 'Untitled Board',
          cards: JSON.parse(JSON.stringify(data.cards || [])),
          connections: JSON.parse(JSON.stringify(data.connections || [])),
          drawings: JSON.parse(JSON.stringify(data.drawings || [])),
          pan: JSON.parse(JSON.stringify(data.pan || { x: 100, y: 100 })),
          zoom: data.zoom || 1.0,
          boardCode: data.code || '',
          boardLanguage: data.language || 'javascript'
        };
        
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
    if (saveStatus === 'auto-saving') return 'Auto Saving...';
    if (saveStatus === 'saving') return 'Saving...';
    if (saveStatus === 'error') return 'Error (Offline)';
    if (hasUnsavedChanges) {
      return shouldGlowAlert ? 'Unsaved (Overdue!)' : 'Unsaved Changes';
    }
    return 'Saved';
  };

  const getSaveDotClass = () => {
    if (saveStatus === 'saving' || saveStatus === 'auto-saving') return 'saving';
    if (saveStatus === 'error') return 'error';
    if (hasUnsavedChanges) {
      return shouldGlowAlert ? 'error' : 'saving'; // red if overdue, amber if unsaved
    }
    return 'saved'; // green if up-to-date
  };

  // Unified save board API function using Delta PATCH with PUT fallback
  const handleSaveBoard = async (isManual = false) => {
    if (isViewOnly) return;
    setSaveStatus(isManual ? 'saving' : 'auto-saving');
    try {
      const current = latestDataRef.current;
      const saved = lastSavedStateRef.current || {
        boardName: '', cards: [], connections: [], drawings: [], pan: { x: 0, y: 0 }, zoom: 1, boardCode: '', boardLanguage: ''
      };

      const savedCardMap = new Map((saved.cards || []).map(c => [c.id, JSON.stringify(c)]));
      const currentCardMap = new Map((current.cards || []).map(c => [c.id, c]));

      const updatedCards = [];
      (current.cards || []).forEach(c => {
        const jsonStr = JSON.stringify(c);
        if (!savedCardMap.has(c.id) || savedCardMap.get(c.id) !== jsonStr) {
          updatedCards.push(c);
        }
      });

      const deletedCardIds = [];
      (saved.cards || []).forEach(c => {
        if (!currentCardMap.has(c.id)) {
          deletedCardIds.push(c.id);
        }
      });

      const deltaPayload = {};
      if (updatedCards.length > 0) deltaPayload.updatedCards = updatedCards;
      if (deletedCardIds.length > 0) deltaPayload.deletedCardIds = deletedCardIds;

      if (JSON.stringify(current.connections) !== JSON.stringify(saved.connections)) {
        deltaPayload.updatedConnections = current.connections;
      }
      if (JSON.stringify(current.drawings) !== JSON.stringify(saved.drawings)) {
        deltaPayload.updatedDrawings = current.drawings;
      }
      if (current.boardName !== saved.boardName) deltaPayload.name = current.boardName;
      if (JSON.stringify(current.pan) !== JSON.stringify(saved.pan)) deltaPayload.pan = current.pan;
      if (current.zoom !== saved.zoom) deltaPayload.zoom = current.zoom;
      if (current.boardCode !== saved.boardCode) deltaPayload.code = current.boardCode;
      if (current.boardLanguage !== saved.boardLanguage) deltaPayload.language = current.boardLanguage;

      if (Object.keys(deltaPayload).length === 0) {
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
        setShouldGlowAlert(false);
        unsavedSinceRef.current = null;
        return;
      }

      let res = await fetch(`${API_BASE}/boards/${boardId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'x-board-password': localPassword
        },
        body: JSON.stringify(deltaPayload),
      });

      // If PATCH is not supported by endpoint, fallback to PUT full payload
      if (!res.ok && (res.status === 405 || res.status === 404)) {
        res = await fetch(`${API_BASE}/boards/${boardId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'x-board-password': localPassword
          },
          body: JSON.stringify({
            name: current.boardName,
            cards: current.cards,
            connections: current.connections,
            drawings: current.drawings,
            pan: current.pan,
            zoom: current.zoom,
            code: current.boardCode,
            language: current.boardLanguage,
          }),
        });
      }

      if (!res.ok) {
        if (res.status === 413) {
          throw new Error('Payload size exceeded server limit (413). Please deploy backend updates to Render or switch VITE_API_URL to localhost.');
        }
        throw new Error(`Failed to save board (HTTP ${res.status})`);
      }

      // Update baseline snapshot
      lastSavedStateRef.current = JSON.parse(JSON.stringify(current));

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

  // Automatic autosave: saves 10 seconds after changes when auto-save is enabled
  useEffect(() => {
    if (isInitialLoad.current || isViewOnly || !autoSaveEnabled || !hasUnsavedChanges) return;

    if (!lastSavedTimestamp) {
      setLastSavedTimestamp(Date.now());
    }

    const timerId = setTimeout(() => {
      if (hasUnsavedChanges) {
        handleSaveBoard(false);
      }
    }, 10000); // 10 seconds

    return () => clearTimeout(timerId);
  }, [cards, connections, drawings, boardName, pan, zoom, boardCode, boardLanguage, hasUnsavedChanges, isViewOnly, autoSaveEnabled]);

  // Periodic fallback check every 10 seconds if unsaved changes exist
  useEffect(() => {
    if (isInitialLoad.current || isViewOnly || !autoSaveEnabled) return;

    const intervalId = setInterval(() => {
      if (hasUnsavedChanges) {
        handleSaveBoard(false);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(intervalId);
  }, [isViewOnly, autoSaveEnabled, hasUnsavedChanges]);

  // Track actual board edits to set hasUnsavedChanges
  useEffect(() => {
    if (isInitialLoad.current || isViewOnly) return;

    setHasUnsavedChanges(true);
    if (!unsavedSinceRef.current) {
      unsavedSinceRef.current = Date.now();
    }
  }, [cards, connections, drawings, boardName, pan, zoom, boardCode, boardLanguage]);

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

    // PANNING & MARQUEE BOX SELECTION MODES
    const isInteractive = e.target.closest('button') || e.target.closest('a') || e.target.closest('select') || e.target.closest('input:not(.card-title-input)');
    const isViewOnlyDrag = isViewOnly && !isInteractive;
    const isBgDrag = e.target === containerRef.current || e.target.className === 'canvas-grid';

    if (isBgDrag || isViewOnlyDrag) {
      const clickStartX = e.clientX;
      const clickStartY = e.clientY;
      const canvasCoords = screenToCanvas(e.clientX, e.clientY);
      let isMarquee = false;

      // Trigger Marquee Selection if box-select mode is active, or if holding Shift key in select mode
      const isMarqueeTrigger = toolMode === 'box-select' || (toolMode === 'select' && e.shiftKey);

      if (!isViewOnly && isMarqueeTrigger && isBgDrag) {
        if (!e.shiftKey) {
          setSelectedCardIds([]);
        }

        const handleMouseMove = (moveEvent) => {
          const dist = Math.hypot(moveEvent.clientX - clickStartX, moveEvent.clientY - clickStartY);
          
          if (!isMarquee && dist > 5) {
            isMarquee = true;
            isPanningRef.current = false;
          }

          if (isMarquee) {
            const currentCoords = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
            setSelectionBox({
              startX: canvasCoords.x,
              startY: canvasCoords.y,
              currentX: currentCoords.x,
              currentY: currentCoords.y
            });

            const minX = Math.min(canvasCoords.x, currentCoords.x);
            const maxX = Math.max(canvasCoords.x, currentCoords.x);
            const minY = Math.min(canvasCoords.y, currentCoords.y);
            const maxY = Math.max(canvasCoords.y, currentCoords.y);

            const overlappedIds = cards.filter((c) => {
              const w = c.width || 250;
              const h = c.height || 200;
              return !(c.x + w < minX || c.x > maxX || c.y + h < minY || c.y > maxY);
            }).map((c) => c.id);

            if (e.shiftKey) {
              setSelectedCardIds((prev) => Array.from(new Set([...prev, ...overlappedIds])));
            } else {
              setSelectedCardIds(overlappedIds);
            }
          } else if (isPanningRef.current) {
            setPan({
              x: moveEvent.clientX - (clickStartX - pan.x),
              y: moveEvent.clientY - (clickStartY - pan.y),
            });
          }
        };

        const handleMouseUp = () => {
          if (isMarquee) {
            justSelectedRef.current = true;
            setTimeout(() => {
              justSelectedRef.current = false;
            }, 150);
          }
          setSelectionBox(null);
          isPanningRef.current = false;
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        isPanningRef.current = true;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return;
      }

      // View-Only or Non-Select mode canvas panning
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

  // Trigger card creation modal
  const handleAddCard = () => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to add cards.', 'error');
      return;
    }
    setCardFeatures({
      notes: true,             // by default enabled
      sketch: false,
      attachments: false,
      tags: false,
      colorPalette: true,      // by default enabled
      completedStatus: true,   // by default enabled
      connectPorts: true       // by default enabled
    });
    setShowAddCardModal(true);
  };

  // Add heading-only node
  const handleAddHeadingCard = () => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to add cards.', 'error');
      return;
    }
    const width = 200;
    const height = 50;
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
      title: 'Heading',
      content: '',
      tags: [],
      color: 'slate',
      type: 'note',
      cardMode: 'notes',
      features: {
        notes: false,
        sketch: false,
        attachments: false,
        tags: false,
        colorPalette: false,
        completedStatus: false,
        connectPorts: true
      }
    };

    setCards((prev) => [...prev, newCard]);
    setSelectedCardId(newCard.id);
    showToast('Heading card added!');
  };

  // Perform card creation after features selection
  const handleAddCardConfirm = () => {
    const hasNotes = cardFeatures.notes;
    const hasSketch = cardFeatures.sketch;
    const hasAttachments = cardFeatures.attachments;
    const hasTags = cardFeatures.tags;

    const hasBodyContent = hasNotes || hasSketch || hasAttachments || hasTags;
    
    let width = 250;
    let height = 180;

    if (!hasBodyContent) {
      width = 200;
      height = 50;
    }

    let spawnX = 150;
    let spawnY = 150;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerCoords = screenToCanvas(rect.left + rect.width / 2 - (width * zoom) / 2, rect.top + rect.height / 2 - (height * zoom) / 2);
      spawnX = centerCoords.x;
      spawnY = centerCoords.y;
    }

    let cardMode = 'notes';
    if (hasNotes) cardMode = 'notes';
    else if (hasSketch) cardMode = 'sketch';
    else if (hasAttachments) cardMode = 'attachments';

    const newCard = {
      id: Math.random().toString(36).substring(2, 11),
      x: spawnX,
      y: spawnY,
      width,
      height,
      title: !hasBodyContent ? 'Heading' : 'Untitled Note',
      content: '',
      tags: [],
      color: 'slate',
      type: 'note',
      cardMode,
      features: { ...cardFeatures }
    };

    setCards((prev) => [...prev, newCard]);
    setSelectedCardId(newCard.id);
    setShowAddCardModal(false);
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

  // Update card values (supports group movement delta when multiple cards selected)
  const handleUpdateCard = (cardId, updatedFields) => {
    if (isViewOnly) return;

    setCards((prev) => {
      const cardToUpdate = prev.find((c) => c.id === cardId);
      if (!cardToUpdate) return prev;

      // Group movement delta calculation
      if ('x' in updatedFields && 'y' in updatedFields && selectedCardIds.includes(cardId) && selectedCardIds.length > 1) {
        const dx = updatedFields.x - cardToUpdate.x;
        const dy = updatedFields.y - cardToUpdate.y;
        if (dx === 0 && dy === 0) return prev;

        return prev.map((c) => {
          if (selectedCardIds.includes(c.id)) {
            return { ...c, x: c.x + dx, y: c.y + dy };
          }
          return c;
        });
      }

      return prev.map((c) => (c.id === cardId ? { ...c, ...updatedFields } : c));
    });
  };

  // Delete card and all its connections (supports group deletion)
  const handleDeleteCard = (cardId) => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to delete cards.', 'error');
      return;
    }
    const idsToDelete = (selectedCardIds.includes(cardId) && selectedCardIds.length > 1) 
      ? selectedCardIds 
      : [cardId];

    setCards((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));
    setConnections((prev) =>
      prev.filter((conn) => !idsToDelete.includes(conn.fromCardId) && !idsToDelete.includes(conn.toCardId))
    );
    setSelectedCardIds([]);
    showToast(`${idsToDelete.length > 1 ? `${idsToDelete.length} cards` : 'Card'} deleted.`);
  };
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

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCardIds.length > 0) {
        e.preventDefault();
        handleDeleteCard(selectedCardIds[0]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCardIds, isViewOnly]);

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
    if (clearConfirmText.trim().toUpperCase() !== 'DELETE') {
      showToast('Please type "DELETE" to confirm clearing the canvas.', 'error');
      return;
    }
    setCards([]);
    setConnections([]);
    setDrawings([]);
    setSelectedCardId(null);
    setShowClearConfirm(false);
    setClearConfirmText('');
    showToast('Canvas wiped clean.');
  };

  const handleCanvasClick = (e) => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (e.target === containerRef.current || e.target.className === 'canvas-grid') {
      setSelectedCardIds([]);
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

  const getCursorStyleCss = (style) => {
    if (toolMode === 'box-select') {
      return 'crosshair';
    }
    if (toolMode === 'select' && style === 'default') {
      return 'grab';
    }
    switch (style) {
      case 'crosshair':
        return 'crosshair';
      case 'laser':
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='8' fill='%23f43f5e' fill-opacity='0.35'/%3E%3Ccircle cx='12' cy='12' r='4' fill='%23f43f5e'/%3E%3Ccircle cx='12' cy='12' r='1.5' fill='%23ffffff'/%3E%3C/svg%3E") 12 12, auto`;
      case 'target':
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' stroke='%2306b6d4' stroke-width='1.5' fill='none'%3E%3Ccircle cx='12' cy='12' r='6'/%3E%3Cline x1='12' y1='2' x2='12' y2='6'/%3E%3Cline x1='12' y1='18' x2='12' y2='22'/%3E%3Cline x1='2' y1='12' x2='22' y2='12'/%3E%3Ccircle cx='12' cy='12' r='1' fill='%2306b6d4'/%3E%3C/svg%3E") 12 12, auto`;
      case 'circle':
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='7' fill='none' stroke='%236366f1' stroke-width='2'/%3E%3Ccircle cx='12' cy='12' r='2' fill='%23a5b4fc'/%3E%3C/svg%3E") 12 12, auto`;
      case 'wand':
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23f59e0b' stroke='%23fbbf24' stroke-width='1'%3E%3Cpolygon points='12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9'/%3E%3C/svg%3E") 12 12, auto`;
      case 'pencil':
        return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'/%3E%3C/svg%3E") 2 22, auto`;
      case 'grab':
        return 'grab';
      case 'default':
      default:
        return 'grab';
    }
  };

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
        onContextMenu={handleContextMenu}
        style={{
          flex: 1,
          position: 'relative',
          height: '100%',
          backgroundColor: boardBgColor,
          cursor: getCursorStyleCss(cursorStyle)
        }}
      >
      {/* Live Minimal Animated Canvas Background Layer */}
      <LiveCanvasBackground type={liveBgStyle} />

      {/* Background Canvas Grid (Hidden when Live Animated BG is active) */}
      {gridType !== 'none' && liveBgStyle === 'none' && (
        <div 
          className={`canvas-grid grid-${gridType}`}
          style={{
            backgroundSize: (() => {
              switch (gridType) {
                case 'blueprint':
                  return `${100 * zoom}px ${100 * zoom}px, ${100 * zoom}px ${100 * zoom}px, ${20 * zoom}px ${20 * zoom}px, ${20 * zoom}px ${20 * zoom}px`;
                case 'major-grid':
                  return `${120 * zoom}px ${120 * zoom}px, ${120 * zoom}px ${120 * zoom}px, ${24 * zoom}px ${24 * zoom}px, ${24 * zoom}px ${24 * zoom}px`;
                default:
                  return `${36 * zoom}px ${36 * zoom}px`;
              }
            })(),
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
            top: '3.2rem',
            left: '0.6rem',
            width: '230px', 
            maxHeight: 'calc(100% - 4.5rem)', 
            display: 'flex', 
            flexDirection: 'column', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            background: 'rgba(10, 10, 15, 0.9)', 
            borderRadius: '10px',
            zIndex: 1001, 
            overflow: 'hidden',
            padding: '0.6rem 0.7rem',
            boxSizing: 'border-box',
            gap: '0.5rem',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 12px 35px rgba(0,0,0,0.6)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 650, color: 'white', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <List size={13} color="var(--accent-cyan)" />
              Canvas Outline
            </h3>
            <button 
              onClick={() => setIsOutlineOpen(false)}
              className="board-card-delete-btn glass"
              style={{ padding: '0.2rem', borderRadius: '4px' }}
              title="Close Outline"
            >
              <X size={12} />
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
                padding: '0.3rem 0.6rem 0.3rem 1.8rem',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '0.75rem',
                boxSizing: 'border-box'
              }}
            />
            <Search size={12} color="var(--color-text-muted)" style={{ position: 'absolute', left: '0.55rem', top: '50%', transform: 'translateY(-50%)' }} />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                ×
              </button>
            )}
          </div>

          {/* Topics List */}
          <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingRight: '0.1rem' }}>
            {filteredCards.length === 0 ? (
              <div style={{ padding: '1.2rem 0.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
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
                      padding: '0.35rem 0.55rem',
                      borderRadius: '6px',
                      background: isActive ? 'rgba(6, 182, 212, 0.18)' : 'rgba(255, 255, 255, 0.02)',
                      border: isActive ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.04)',
                      color: isActive ? '#cffafe' : 'var(--color-text-main)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 600 : 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                    }}
                    title={`Focus on: ${text}`}
                  >
                    <span style={{ fontSize: '0.8rem', flexShrink: 0 }}>
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

      {/* Canvas Header (Left top navbar) */}
      <div 
        className="glass canvas-header"
        style={{
          position: 'fixed',
          top: '0.6rem',
          left: '0.6rem',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.5rem',
          borderRadius: '8px',
          background: 'rgba(10, 10, 15, 0.6)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        }}
      >
        <button 
          className="board-card-delete-btn glass"
          style={{ padding: '0.35rem 0.45rem', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
          onClick={onBack}
          title="Back to Dashboard"
        >
          <ArrowLeft size={13} />
        </button>
 
        <button 
          className={`board-card-delete-btn glass ${isOutlineOpen ? 'active' : ''}`}
          style={{ 
            padding: '0.35rem 0.55rem', 
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
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
          <List size={13} />
          <span className="header-btn-text" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Outline</span>
        </button>
 
        <button 
          className="board-card-delete-btn glass"
          style={{ 
            padding: '0.35rem 0.55rem', 
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            background: 'rgba(18, 18, 24, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            color: 'var(--color-text-main)'
          }}
          onClick={handleBirdsEyeView}
          title="Bird's Eye View (Zoom Out to Fit All Cards)"
        >
          <Compass size={13} />
          <span className="header-btn-text" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Bird's Eye</span>
        </button>
 
        <button 
          className={`board-card-delete-btn glass ${isCodePanelOpen ? 'active' : ''}`}
          style={{ 
            padding: '0.35rem 0.55rem', 
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
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
          <Code2 size={13} />
          <span className="header-btn-text" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Sandbox</span>
        </button>
 
        <button 
          className={`board-card-delete-btn glass ${isFullscreen ? 'active' : ''}`}
          style={{ 
            padding: '0.35rem 0.55rem', 
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            background: isFullscreen ? 'rgba(99, 102, 241, 0.2)' : 'rgba(18, 18, 24, 0.4)',
            border: isFullscreen ? '1px solid var(--accent-indigo)' : '1px solid rgba(255, 255, 255, 0.05)',
            color: isFullscreen ? '#a5b4fc' : 'var(--color-text-main)'
          }}
          onClick={handleToggleFullscreen}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          <span className="header-btn-text" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </span>
        </button>
 
        <input 
          type="text"
          value={boardName}
          onChange={(e) => setBoardName(e.target.value)}
          className="modal-input canvas-title-input"
          readOnly={isViewOnly}
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            background: 'rgba(18, 18, 24, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            padding: '0.25rem 0.5rem',
            borderRadius: '6px',
            fontFamily: 'var(--font-heading)',
            maxWidth: '140px'
          }}
          title={isViewOnly ? 'Board is locked' : 'Click to rename Board'}
        />
 
        {protectionMode !== 'none' && (
          isViewOnly ? (
            <button
              className="board-card-delete-btn glass"
              style={{
                padding: '0.3rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                color: 'var(--accent-rose)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                cursor: 'pointer'
              }}
              onClick={() => {
                setShowUnlockModal(true);
                setUnlockPassInput('');
              }}
              title="Board is locked for editing. Click to unlock."
            >
              <Lock size={11} color="var(--accent-rose)" />
              <span className="header-btn-text">View</span>
            </button>
          ) : (
            <div
              className="glass"
              style={{
                padding: '0.3rem 0.5rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                color: 'var(--accent-emerald)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                userSelect: 'none'
              }}
              title="Editing is unlocked."
            >
              <Unlock size={11} color="var(--accent-emerald)" />
              <span className="header-btn-text">Edit</span>
            </div>
          )
        )}
      </div>

      {/* Save Status Indicators & Compact Manual Save Button (Right top navbar) */}
      {!isViewOnly && (
        <div 
          className={`save-status-indicator glass ${shouldGlowAlert ? 'alert-glow' : ''}`} 
          style={{ 
            position: 'fixed',
            top: '0.6rem',
            right: '0.6rem',
            gap: '0.5rem', 
            padding: '0.3rem 0.6rem',
            borderRadius: '8px',
            border: shouldGlowAlert ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            zIndex: 1000,
            background: 'rgba(10, 10, 15, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <div className={`save-dot ${getSaveDotClass()}`} />
            <span 
              style={{ 
                color: shouldGlowAlert ? 'var(--accent-rose)' : 'var(--color-text-muted)', 
                fontSize: '0.75rem',
                fontWeight: shouldGlowAlert ? 600 : 500
              }}
            >
              {getSaveStatusLabel()}
            </span>
          </div>

          <button
            onClick={() => handleSaveBoard(true)}
            style={{
              background: saveStatus === 'saving' ? 'rgba(99, 102, 241, 0.25)' : shouldGlowAlert ? 'rgba(244, 63, 94, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              border: shouldGlowAlert ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '0.3rem 0.45rem',
              color: shouldGlowAlert ? '#fecdd3' : '#a5b4fc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
            title="Save changes manually (Ctrl+S)"
            className="manual-save-btn"
          >
            <Save size={13} className={(saveStatus === 'saving' || saveStatus === 'auto-saving') ? 'spinning' : ''} />
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

              const getColorForCard = (c) => {
                if (c.badge && c.badge.color) return c.badge.color;
                if (c.isStartNode) return '#881337';
                if (c.color && c.color.startsWith('#')) return c.color;
                return accentColors[c.color] || '#6366f1';
              };

              const colorA = getColorForCard(cardA);
              const colorB = getColorForCard(cardB);

              const fromSide = conn.fromSide || 'right';
              const toSide = conn.toSide || 'left';
              const from = getPortCoords(cardA, fromSide);
              const to = getPortCoords(cardB, toSide);

              return (
                <linearGradient 
                  key={`grad-${conn.id}`} 
                  id={`grad-${conn.id}`} 
                  gradientUnits="userSpaceOnUse"
                  x1={from.x} 
                  y1={from.y} 
                  x2={to.x} 
                  y2={to.y}
                >
                  <stop offset="0%" stopColor={colorA} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={colorB} stopOpacity="0.9" />
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
                  fill="none"
                  strokeWidth="2.5"
                  className="connection-line"
                  stroke={`url(#grad-${conn.id})`}
                  style={{ cursor: 'pointer', filter: 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.4))' }}
                  onClick={() => handleDeleteConnection(conn.id)}
                  title="Click to delete connection"
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
              isSelected={selectedCardIds.includes(card.id)}
              onSelect={handleSelectCard}
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

        {/* Marquee Drag Box Selection Overlay */}
        {selectionBox && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(selectionBox.startX, selectionBox.currentX)}px`,
              top: `${Math.min(selectionBox.startY, selectionBox.currentY)}px`,
              width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}px`,
              height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}px`,
              border: '1.5px dashed #818cf8',
              background: 'rgba(99, 102, 241, 0.16)',
              borderRadius: '4px',
              pointerEvents: 'none',
              zIndex: 1000,
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.25)'
            }}
          />
        )}

        {/* Group Selection Bounding Box Container */}
        {groupBoundingBox && !isViewOnly && (
          <div
            className="group-selection-container"
            onMouseDown={handleGroupDragMouseDown}
            style={{
              position: 'absolute',
              left: `${groupBoundingBox.x}px`,
              top: `${groupBoundingBox.y}px`,
              width: `${groupBoundingBox.width}px`,
              height: `${groupBoundingBox.height}px`,
              border: '2px dashed var(--accent-indigo)',
              background: 'rgba(99, 102, 241, 0.07)',
              borderRadius: '12px',
              zIndex: 5000,
              cursor: 'grab',
              boxShadow: '0 0 24px rgba(99, 102, 241, 0.25)',
              pointerEvents: 'auto',
              boxSizing: 'border-box',
              userSelect: 'none'
            }}
            title="Drag from anywhere inside this container to move all selected cards"
          >
            {/* Group Header Badge */}
            <div
              style={{
                position: 'absolute',
                top: '-26px',
                left: '0',
                background: 'rgba(99, 102, 241, 0.9)',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                letterSpacing: '0.3px',
                pointerEvents: 'none'
              }}
            >
              <Move size={11} />
              <span>{groupBoundingBox.cardCount} Cards Selected (Drag to Move)</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Canvas Toolbar controls */}
      {!isViewOnly && (
        <Toolbar
          onAddCard={handleAddCard}
          onAddHeadingCard={handleAddHeadingCard}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onToggleGrid={() => setGridType((prev) => (prev === 'none' ? 'dots' : 'none'))}
          gridVisible={gridType !== 'none'}
          gridType={gridType}
          onChangeGridType={setGridType}
          boardBgColor={boardBgColor}
          onChangeBoardBgColor={setBoardBgColor}
          liveBgStyle={liveBgStyle}
          onChangeLiveBgStyle={setLiveBgStyle}
          cursorStyle={cursorStyle}
          onChangeCursorStyle={setCursorStyle}
          onClearBoard={() => {
            setClearConfirmText('');
            setShowClearConfirm(true);
          }}
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
        <div 
          className="modal-overlay" 
          onClick={() => {
            setShowClearConfirm(false);
            setClearConfirmText('');
          }}
        >
          <div 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
            style={{ minWidth: '320px', maxWidth: '380px' }}
          >
            <h2 className="modal-title" style={{ color: 'var(--accent-rose)' }}>Wipe Canvas Clean?</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', lineHeight: '1.4', marginBottom: '0.6rem' }}>
              This will permanently delete all cards, images, drawings, and connection lines on this board.
            </p>

            <div style={{ margin: '0.8rem 0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.75)', fontWeight: 500 }}>
                To confirm, type <strong style={{ color: 'var(--accent-rose)', letterSpacing: '1px' }}>DELETE</strong> in the box below:
              </label>
              <input
                type="text"
                className="modal-input"
                placeholder='Type "DELETE" to confirm'
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && clearConfirmText.trim().toUpperCase() === 'DELETE') {
                    handleClearBoard();
                  }
                }}
                autoFocus
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: clearConfirmText.trim().toUpperCase() === 'DELETE' 
                    ? '1px solid var(--accent-rose)' 
                    : '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '0.5rem 0.8rem',
                  color: '#ffffff',
                  fontSize: '0.88rem',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setShowClearConfirm(false);
                  setClearConfirmText('');
                }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                disabled={clearConfirmText.trim().toUpperCase() !== 'DELETE'}
                style={{ 
                  background: clearConfirmText.trim().toUpperCase() === 'DELETE' ? 'var(--accent-rose)' : 'rgba(244, 63, 94, 0.25)', 
                  color: clearConfirmText.trim().toUpperCase() === 'DELETE' ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                  cursor: clearConfirmText.trim().toUpperCase() === 'DELETE' ? 'pointer' : 'not-allowed',
                  boxShadow: clearConfirmText.trim().toUpperCase() === 'DELETE' ? '0 4px 14px rgba(244, 63, 94, 0.4)' : 'none',
                  border: 'none',
                  fontWeight: 600,
                  transition: 'all 0.2s ease'
                }}
                onClick={handleClearBoard}
              >
                Wipe Clean
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customize Card Features Modal */}
      {showAddCardModal && (
        <div className="modal-overlay" onClick={() => setShowAddCardModal(false)}>
          <div 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
            style={{ minWidth: '300px', maxWidth: '340px', padding: '1.2rem' }}
          >
            <h2 className="modal-title" style={{ color: 'var(--accent-cyan)', fontSize: '1.2rem', marginBottom: '0.4rem' }}>Configure Card Features</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', lineHeight: '1.3', marginBottom: '0.8rem' }}>
              Choose which sections to include in this card. (Text Field, Palette, checkmark status, and ports are included automatically).
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', margin: '0.8rem 0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input 
                  type="checkbox" 
                  checked={cardFeatures.sketch} 
                  onChange={(e) => setCardFeatures(prev => ({ ...prev, sketch: e.target.checked }))}
                  style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--accent-cyan)' }}
                />
                <span>🎨 Draw Canvas (Sketch)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input 
                  type="checkbox" 
                  checked={cardFeatures.attachments} 
                  onChange={(e) => setCardFeatures(prev => ({ ...prev, attachments: e.target.checked }))}
                  style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--accent-cyan)' }}
                />
                <span>📎 Attachment Files</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input 
                  type="checkbox" 
                  checked={cardFeatures.tags} 
                  onChange={(e) => setCardFeatures(prev => ({ ...prev, tags: e.target.checked }))}
                  style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--accent-cyan)' }}
                />
                <span>🏷️ Tags Section</span>
              </label>
            </div>

            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowAddCardModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                style={{ background: 'var(--accent-cyan)', boxShadow: '0 4px 14px rgba(6, 182, 212, 0.3)', color: '#000', fontWeight: 'bold' }}
                onClick={handleAddCardConfirm}
              >
                Create Card
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
          width: `${codePanelWidth}px`, 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          borderLeft: isResizingSandbox ? '2px solid var(--accent-indigo)' : '1px solid rgba(255, 255, 255, 0.1)', 
          background: 'rgba(10, 10, 15, 0.95)', 
          zIndex: 1001, 
          overflow: 'hidden',
          padding: '1.2rem',
          boxSizing: 'border-box',
          gap: '1rem',
          backdropFilter: 'blur(10px)',
          position: 'relative',
          transition: isResizingSandbox ? 'none' : 'width 0.1s ease'
        }}
      >
        {/* Left edge resize drag handle */}
        <div
          onMouseDown={handleSandboxResizeMouseDown}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '10px',
            height: '100%',
            cursor: 'col-resize',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isResizingSandbox ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
            transition: 'background 0.2s'
          }}
          className="sandbox-resize-handle"
          title="Drag left/right to resize Code Sandbox panel"
        >
          <div 
            style={{
              width: '2px',
              height: '36px',
              borderRadius: '2px',
              background: isResizingSandbox ? 'var(--accent-indigo)' : 'rgba(255, 255, 255, 0.2)',
              boxShadow: isResizingSandbox ? '0 0 10px var(--accent-indigo)' : 'none'
            }}
          />
        </div>
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

        {/* Editor TextArea Container with Line Numbers Gutter */}
        <div 
          style={{ 
            flexGrow: 1, 
            position: 'relative', 
            display: 'flex', 
            background: 'rgba(0,0,0,0.5)', 
            border: '1px solid rgba(255,255,255,0.1)', 
            borderRadius: '8px', 
            overflow: 'hidden' 
          }}
        >
          {/* Synchronized Line Numbers Column */}
          <div 
            ref={lineNumbersRef}
            style={{
              padding: '0.8rem 0.5rem',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'rgba(255, 255, 255, 0.35)',
              fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace",
              fontSize: '0.82rem',
              lineHeight: '1.45',
              textAlign: 'right',
              userSelect: 'none',
              minWidth: '36px',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}
          >
            {Array.from({ length: Math.max(1, (boardCode || getPlaceholderForLang(boardLanguage)).split('\n').length) }, (_, i) => (
              <div key={i + 1}>{i + 1}</div>
            ))}
          </div>

          <textarea
            className="card-code-textarea"
            value={boardCode}
            onChange={(e) => setBoardCode(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            onScroll={(e) => {
              if (lineNumbersRef.current) {
                lineNumbersRef.current.scrollTop = e.target.scrollTop;
              }
            }}
            placeholder={getPlaceholderForLang(boardLanguage)}
            style={{ 
              flexGrow: 1, 
              width: '100%', 
              fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace", 
              fontSize: '0.82rem', 
              lineHeight: '1.45',
              background: 'transparent', 
              border: 'none', 
              outline: 'none',
              color: '#f4f4f7', 
              padding: '0.8rem',
              resize: 'none',
              tabSize: 2
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

    {/* Custom Right-Click Context Menu Bar */}
    {contextMenu && (
      <div
        className="context-menu-popover glass"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          position: 'fixed',
          left: `${contextMenu.x}px`,
          top: `${contextMenu.y}px`,
          zIndex: 99999,
          background: 'rgba(14, 14, 22, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          boxShadow: '0 14px 40px rgba(0, 0, 0, 0.75)',
          minWidth: '200px',
          animation: 'contextMenuScaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}
      >
        {selectedCardIds.length > 1 ? (
          <>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-indigo)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Multi-Card Selection ({selectedCardIds.length})
            </span>
            <button
              className="context-menu-item"
              onClick={() => {
                handleDuplicateCard(selectedCardIds[0]);
                setContextMenu(null);
              }}
            >
              <Copy size={13} color="#a5b4fc" />
              <span>Copy / Duplicate All Selected</span>
              <span className="context-shortcut">Ctrl+D</span>
            </button>

            {!isViewOnly && (
              <button
                className="context-menu-item danger"
                onClick={() => {
                  handleDeleteCard(selectedCardIds[0]);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={13} color="var(--accent-rose)" />
                <span>Delete All Selected ({selectedCardIds.length})</span>
                <span className="context-shortcut">Del</span>
              </button>
            )}

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '3px 0' }} />
          </>
        ) : contextMenu.cardId ? (
          <>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-indigo)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Card Actions
            </span>
            <button
              className="context-menu-item"
              onClick={() => {
                handleDuplicateCard(contextMenu.cardId);
                setContextMenu(null);
              }}
            >
              <Copy size={13} color="#a5b4fc" />
              <span>Duplicate Card</span>
              <span className="context-shortcut">Ctrl+D</span>
            </button>

            <button
              className="context-menu-item"
              onClick={() => {
                const card = cards.find((c) => c.id === contextMenu.cardId);
                if (card) handleFocusOnCard(card);
                setContextMenu(null);
              }}
            >
              <Target size={13} color="#cffafe" />
              <span>Focus / Zoom Card</span>
            </button>

            {!isViewOnly && (
              <button
                className="context-menu-item danger"
                onClick={() => {
                  handleDeleteCard(contextMenu.cardId);
                  setContextMenu(null);
                }}
              >
                <Trash2 size={13} color="var(--accent-rose)" />
                <span>Delete Card</span>
              </button>
            )}

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '3px 0' }} />
          </>
        ) : null}

        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Canvas Actions
        </span>

        {!isViewOnly && (
          <>
            <button
              className="context-menu-item"
              onClick={() => {
                handleAddCard();
                setContextMenu(null);
              }}
            >
              <Plus size={13} color="var(--accent-cyan)" />
              <span>New Card</span>
            </button>

            <button
              className="context-menu-item"
              onClick={() => {
                handleAddHeadingCard();
                setContextMenu(null);
              }}
            >
              <Type size={13} color="var(--accent-indigo)" />
              <span>New Heading</span>
            </button>

            <button
              className="context-menu-item"
              onClick={() => {
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) fileInput.click();
                setContextMenu(null);
              }}
            >
              <ImageIcon size={13} color="var(--accent-emerald)" />
              <span>Upload Image...</span>
            </button>

            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '3px 0' }} />
          </>
        )}

        <button
          className="context-menu-item"
          onClick={() => {
            setIsCodePanelOpen(!isCodePanelOpen);
            setContextMenu(null);
          }}
        >
          <Code2 size={13} color="var(--accent-amber)" />
          <span>{isCodePanelOpen ? 'Close Code Sandbox' : 'Open Code Sandbox'}</span>
        </button>

        <button
          className="context-menu-item"
          onClick={() => {
            setIsOutlineOpen(!isOutlineOpen);
            setContextMenu(null);
          }}
        >
          <List size={13} color="var(--accent-cyan)" />
          <span>{isOutlineOpen ? 'Close Outline' : 'Open Outline'}</span>
        </button>

        <button
          className="context-menu-item"
          onClick={() => {
            handleResetZoom();
            setContextMenu(null);
          }}
        >
          <Maximize2 size={13} />
          <span>Recenter Viewport</span>
        </button>

        {!isViewOnly && (
          <>
            <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '3px 0' }} />
            <button
              className="context-menu-item danger"
              onClick={() => {
                setClearConfirmText('');
                setShowClearConfirm(true);
                setContextMenu(null);
              }}
            >
              <Trash2 size={13} color="var(--accent-rose)" />
              <span>Wipe Canvas Clean</span>
            </button>
          </>
        )}
      </div>
    )}
  </div>
);
}

export default CanvasBoard;
