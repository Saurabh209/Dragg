import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Card, { LANGUAGES, getPlaceholderForLang } from '../shared/Card';
import LeftVerticalToolbar from '../shared/LeftVerticalToolbar';
import { ArrowLeft, Lock, Unlock, Eye, EyeOff, Code2, X, Play, List, Search, Compass, Maximize2, Minimize2, Save, Copy, Target, Type, Image as ImageIcon, Plus, Trash2, Move, Check, Box, Link2, ZoomIn, ZoomOut, Maximize, Tag, Download, Clipboard, AlertTriangle, Sparkles, AlignLeft } from 'lucide-react';
import GroupContainer from '../shared/GroupContainer';
import DraggClipboardSlider, { copyToDraggClipboard, getDraggClipboardItems } from '../shared/DraggClipboardSlider';
import { getDraggItem, setDraggItem, getDraggBoardPass, setDraggBoardPass } from '../../utils/draggStorage';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper functions for obstacle-avoiding orthogonal connector routing
const intersectsRect = (p1, p2, rect) => {
  if (!rect) return false;
  const pad = 0; // 0 padding so lines lying on the border are detected as intersecting
  const left = rect.left + pad;
  const right = rect.right - pad;
  const top = rect.top + pad;
  const bottom = rect.bottom - pad;

  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);

  // If vertical line
  if (Math.abs(p1.x - p2.x) < 0.1) {
    return p1.x >= left && p1.x <= right && minY <= bottom && maxY >= top;
  }
  // If horizontal line
  if (Math.abs(p1.y - p2.y) < 0.1) {
    return p1.y >= top && p1.y <= bottom && minX <= right && maxX >= left;
  }

  return false;
};

const getClosestPointOnRectBorder = (point, rect) => {
  if (!rect) return point;
  const x = point.x;
  const y = point.y;

  const clampedX = Math.max(rect.left, Math.min(rect.right, x));
  const clampedY = Math.max(rect.top, Math.min(rect.bottom, y));

  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    return { x: clampedX, y: clampedY };
  }

  const distL = x - rect.left;
  const distR = rect.right - x;
  const distT = y - rect.top;
  const distB = rect.bottom - y;

  const minDist = Math.min(distL, distR, distT, distB);

  if (minDist === distL) return { x: rect.left, y };
  if (minDist === distR) return { x: rect.right, y };
  if (minDist === distT) return { x, y: rect.top };
  return { x, y: rect.bottom };
};

const isPathSafe = (points, rectA, rectB) => {
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    if (i === 0) {
      // First segment: exits rectA. Only check intersection with rectB.
      if (intersectsRect(p1, p2, rectB)) return false;
    } else if (i === points.length - 2) {
      // Last segment: enters rectB. Only check intersection with rectA.
      if (intersectsRect(p1, p2, rectA)) return false;
    } else {
      // Intermediate segments: check both rectA and rectB.
      if (intersectsRect(p1, p2, rectA) || intersectsRect(p1, p2, rectB)) return false;
    }
  }
  return true;
};

const optimizePoints = (pts) => {
  if (pts.length <= 2) return pts;
  const result = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    if (Math.abs(curr.x - prev.x) < 0.1 && Math.abs(curr.y - prev.y) < 0.1) {
      continue;
    }

    const isCollinearX = Math.abs(prev.x - curr.x) < 0.1 && Math.abs(curr.x - next.x) < 0.1;
    const isCollinearY = Math.abs(prev.y - curr.y) < 0.1 && Math.abs(curr.y - next.y) < 0.1;

    if (isCollinearX || isCollinearY) {
      continue;
    }

    result.push(curr);
  }
  const last = pts[pts.length - 1];
  const prev = result[result.length - 1];
  if (!(Math.abs(last.x - prev.x) < 0.1 && Math.abs(last.y - prev.y) < 0.1)) {
    result.push(last);
  }
  return result;
};

const getPathLength = (pts) => {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
  }
  return len;
};

const getPathMidpoint = (pts) => {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };

  const totalLen = getPathLength(pts);
  const targetLen = totalLen / 2;

  let currentLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (currentLen + segLen >= targetLen) {
      const ratio = segLen === 0 ? 0 : (targetLen - currentLen) / segLen;
      return {
        x: p1.x + (p2.x - p1.x) * ratio,
        y: p1.y + (p2.y - p1.y) * ratio
      };
    }
    currentLen += segLen;
  }
  return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
};

const pointsToSvgPath = (points, r) => {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let pathStr = `M ${points[0].x} ${points[0].y}`;
  let penX = points[0].x;
  let penY = points[0].y;

  for (let i = 1; i < points.length - 1; i++) {
    const pPrev = points[i - 1];
    const pCurr = points[i];
    const pNext = points[i + 1];

    const v1 = { x: pCurr.x - pPrev.x, y: pCurr.y - pPrev.y };
    const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };

    const len1 = Math.hypot(v1.x, v1.y);
    const len2 = Math.hypot(v2.x, v2.y);

    if (len1 === 0 || len2 === 0) continue;

    const dir1 = { x: v1.x / len1, y: v1.y / len1 };
    const dir2 = { x: v2.x / len2, y: v2.y / len2 };

    const maxR1 = (i === 1) ? len1 : len1 / 2;
    const maxR2 = (i === points.length - 2) ? len2 : len2 / 2;
    const actualR = Math.min(r, maxR1, maxR2);

    if (actualR <= 1) {
      if (Math.hypot(pCurr.x - penX, pCurr.y - penY) > 0.1) {
        pathStr += ` L ${pCurr.x} ${pCurr.y}`;
        penX = pCurr.x;
        penY = pCurr.y;
      }
    } else {
      const pStart = {
        x: pCurr.x - dir1.x * actualR,
        y: pCurr.y - dir1.y * actualR
      };
      const pEnd = {
        x: pCurr.x + dir2.x * actualR,
        y: pCurr.y + dir2.y * actualR
      };

      if (Math.hypot(pStart.x - penX, pStart.y - penY) > 0.1) {
        pathStr += ` L ${pStart.x} ${pStart.y}`;
      }
      pathStr += ` Q ${pCurr.x} ${pCurr.y}, ${pEnd.x} ${pEnd.y}`;
      penX = pEnd.x;
      penY = pEnd.y;
    }
  }

  const lastPt = points[points.length - 1];
  if (Math.hypot(lastPt.x - penX, lastPt.y - penY) > 0.1) {
    pathStr += ` L ${lastPt.x} ${lastPt.y}`;
  }
  return pathStr;
};

function FreestyleCanvas({ boardId, boardPassword, onUpdatePassword = () => {}, onBack, showToast, forceViewOnly = false }) {
  const [boardName, setBoardName] = useState('');
  const [cards, setCards] = useState([]);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const [connections, setConnections] = useState([]);
  const [drawings, setDrawings] = useState([]); // Array of strokes: { tool, color, thickness, points }
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [zoom, setZoom] = useState(1.0);
  const [gridType, setGridType] = useState(() => {
    return getDraggItem('gridType', 'none');
  });
  const [boardBgColor, setBoardBgColor] = useState('#0a0a0c');
  const [cursorStyle, setCursorStyle] = useState(() => {
    return getDraggItem('cursorStyle', 'default');
  });
  const [liveBgStyle, setLiveBgStyle] = useState('none');
  const [toolbarSettings, setToolbarSettings] = useState({
    position: { x: 20, y: 200 },
    orientation: 'vertical'
  });
  const [stylePresets, setStylePresets] = useState(() => {
    try {
      return getDraggItem('stylePresets', []);
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    setDraggItem('stylePresets', stylePresets);
  }, [stylePresets]);

  const debugRouting = false;

  // Multi-card selection states
  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [selectionBox, setSelectionBox] = useState(null);
  const selectedCardId = selectedCardIds[0] || null;
  const setSelectedCardId = (id) => setSelectedCardIds(id ? [id] : []);

  // System Design states & modals
  const [isSystemCatalogOpen, setIsSystemCatalogOpen] = useState(false);
  const [inspectingSystemNode, setInspectingSystemNode] = useState(null);
  const [activeCodeStorageCard, setActiveCodeStorageCard] = useState(null);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K) for System Architecture Catalog
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSystemCatalogOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectSystemNode = (item) => {
    const newCard = {
      id: 'sys_' + Date.now(),
      type: item.id === 'group' ? 'group_container' : 'system_node',
      nodeType: item.id,
      title: item.name,
      category: item.category,
      color: item.color || '#10b981',
      x: Math.round(-pan.x + window.innerWidth / 2 - 100),
      y: Math.round(-pan.y + window.innerHeight / 2 - 80),
      width: item.id === 'group' ? 320 : 220,
      height: item.id === 'group' ? 140 : 130,
      tags: item.category ? [item.category] : [],
      description: item.id === 'load_balancer' ? 'Routes API traffic' : (item.id === 'scheduler' ? 'Triggers scheduled work' : 'System component'),
      isConfigured: false,
      systemConfig: {
        layer: 'Layer 7',
        strategy: 'Round robin',
        healthChecks: 'Active',
        sessionAffinity: 'None',
        failover: 'Multi-zone',
        scheduleType: 'Cron',
        scheduleCron: '0 0 * * *',
        timezone: 'UTC',
        overlap: 'Skip',
        missedRuns: 'Run once',
        retryPolicy: 'None'
      },
      code: item.id === 'code_card' ? '// Paste copied code snippet here' : '',
      language: 'javascript'
    };

    setCards((prev) => [...prev, newCard]);
  };

  const handleSaveSystemNodeConfig = (nodeId, updatedFields) => {
    setCards((prev) =>
      prev.map((c) => (c.id === nodeId ? { ...c, ...updatedFields } : c))
    );
  };

  const handleSaveCodeSnippet = (cardId, updatedFields) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, ...updatedFields } : c))
    );
  };

  useEffect(() => {
    setDraggItem('gridType', gridType);
  }, [gridType]);

  useEffect(() => {
    setDraggItem('cursorStyle', cursorStyle);
  }, [cursorStyle]);

  // Security locks states
  const [localPassword, setLocalPassword] = useState(() => {
    return boardPassword || getDraggBoardPass(boardId) || '';
  });
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
    return getDraggItem('autoSaveEnabled', true);
  });

  useEffect(() => {
    setDraggItem('autoSaveEnabled', autoSaveEnabled);
  }, [autoSaveEnabled]);

  // For connection creation
  const [draftConnection, setDraftConnection] = useState(null);
  const draftConnectionRef = useRef(null);
  const justFinishedDraftRef = useRef(false);
  const [activeConnectorStyle, setActiveConnectorStyle] = useState('default');
  const [activeConnectorColor, setActiveConnectorColor] = useState('auto');
  const [activeConnectorAnimation, setActiveConnectorAnimation] = useState('none');
  const [activeConnectorThickness, setActiveConnectorThickness] = useState(2.5);
  const [cardNodeLayout, setCardNodeLayout] = useState('four-node'); // 'four-node' | 'freestyle'

  const handleConnectorThicknessChange = (newThickness) => {
    setActiveConnectorThickness(newThickness);
  };

  const handleConnectorStyleChange = (newStyle) => {
    setActiveConnectorStyle(newStyle);
  };

  const handleConnectorColorChange = (newColor) => {
    setActiveConnectorColor(newColor);
  };

  const handleConnectorAnimationChange = (newAnim) => {
    setActiveConnectorAnimation(newAnim);
  };

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
    const saved = getDraggItem('sandboxWidth', null);
    return saved ? parseInt(saved, 10) : 450;
  });
  const [isResizingSandbox, setIsResizingSandbox] = useState(false);

  // Custom Right Click Context Menu state
  const [contextMenu, setContextMenu] = useState(null);
  const [activeBadgePickerCardId, setActiveBadgePickerCardId] = useState(null);
  const contextMenuRef = useRef(null);

  // Ghost Placement Shadow state for cursor-attached card creation
  const [pendingPlacementCard, setPendingPlacementCard] = useState(null);
  const [placementPos, setPlacementPos] = useState({ x: 150, y: 150 });
  const lastPointerPosRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  useEffect(() => {
    const handleGlobalPointerMove = (e) => {
      lastPointerPosRef.current = { x: e.clientX, y: e.clientY };

      if (pendingPlacementCard && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - pan.x) / zoom;
        const canvasY = (e.clientY - rect.top - pan.y) / zoom;
        setPlacementPos({
          x: canvasX - (pendingPlacementCard.width || 250) / 2,
          y: canvasY - (pendingPlacementCard.height || 180) / 2,
        });
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    return () => window.removeEventListener('pointermove', handleGlobalPointerMove);
  }, [pendingPlacementCard, pan, zoom]);

  const startCardPlacement = (newCard) => {
    let initX = 150;
    let initY = 150;
    if (containerRef.current && lastPointerPosRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      initX = (lastPointerPosRef.current.x - rect.left - pan.x) / zoom - (newCard.width || 250) / 2;
      initY = (lastPointerPosRef.current.y - rect.top - pan.y) / zoom - (newCard.height || 180) / 2;
    }
    setPlacementPos({ x: initX, y: initY });
    setPendingPlacementCard(newCard);
    showToast('Click anywhere on canvas to place card (Esc to cancel)', 'info');
  };

  // Cancel placement on Esc key
  useEffect(() => {
    const handleEscPlacement = (e) => {
      if (e.key === 'Escape' && pendingPlacementCard) {
        setPendingPlacementCard(null);
        showToast('Card placement canceled.');
      }
    };
    window.addEventListener('keydown', handleEscPlacement);
    return () => window.removeEventListener('keydown', handleEscPlacement);
  }, [pendingPlacementCard]);

  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current) return;

    const menuRect = contextMenuRef.current.getBoundingClientRect();
    const { x, y } = contextMenu;

    let adjustedX = x;
    let adjustedY = y;

    if (x + menuRect.width > window.innerWidth - 12) {
      adjustedX = window.innerWidth - menuRect.width - 12;
    }
    if (adjustedX < 12) adjustedX = 12;

    if (y + menuRect.height > window.innerHeight - 12) {
      adjustedY = Math.max(12, window.innerHeight - menuRect.height - 12);
    }
    if (adjustedY < 12) adjustedY = 12;

    if (adjustedX !== x || adjustedY !== y) {
      contextMenuRef.current.style.left = `${adjustedX}px`;
      contextMenuRef.current.style.top = `${adjustedY}px`;
    }
  }, [contextMenu]);

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

    if (isViewOnly && !targetCardId && !highlightedPathCardDepths) {
      setContextMenu(null);
      return;
    }

    const menuWidth = 230;
    const menuHeight = 450; // Conservative max height to ensure all options fit in viewport

    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth - 12) {
      x = window.innerWidth - menuWidth - 12;
    }
    if (x < 12) x = 12;

    if (y + menuHeight > window.innerHeight - 12) {
      y = Math.max(12, window.innerHeight - menuHeight - 12);
    }
    if (y < 12) y = 12;

    setDeleteConfirmTarget(null);
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
            // Block moving if card is individually locked or its parent group is locked
            const parentGroup = c.groupId ? prev.find(g => g.id === c.groupId) : null;
            const isCardLocked = c.isLocked || (parentGroup && parentGroup.isLocked);
            if (isCardLocked) return c;

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
    setDraggItem('sandboxWidth', codePanelWidth);
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

  // Canvas Outline Sidebar state
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [outlineFilter, setOutlineFilter] = useState(() => {
    return getDraggItem('outlineFilter', 'all');
  });

  useEffect(() => {
    setDraggItem('outlineFilter', outlineFilter);
  }, [outlineFilter]);

  const [blinkingCardId, setBlinkingCardId] = useState(null);
  const [showTextFormatBar, setShowTextFormatBar] = useState(false);

  // Connection Path Highlight states
  const [highlightedPathStartCardId, setHighlightedPathStartCardId] = useState('');
  const [highlightedPathCardDepths, setHighlightedPathCardDepths] = useState(null); // Map of cardId -> depth
  const [highlightedPathConnectionIds, setHighlightedPathConnectionIds] = useState(null); // Array of connectionIds
  const [activeHighlightedCustomId, setActiveHighlightedCustomId] = useState(null);

  const [editingConnId, setEditingConnId] = useState(null);
  const [hoveredConnId, setHoveredConnId] = useState(null);

  const handleClearHighlight = () => {
    setHighlightedPathStartCardId('');
    setHighlightedPathCardDepths(null);
    setHighlightedPathConnectionIds(null);
    setActiveHighlightedCustomId(null);
  };

  const handleUpdateConnectionId = (connId, customId) => {
    const cleanId = String(customId || '').trim();
    setConnections((prev) =>
      prev.map((c) => (c.id === connId ? { ...c, customId: cleanId } : c))
    );
    if (cleanId) {
      showToast(`Connection node ID set to "${cleanId}"`, 'success');
    }
  };

  const handleHighlightAllConnected = (startCardId) => {
    if (!startCardId) return;

    if (highlightedPathStartCardId === startCardId) {
      handleClearHighlight();
      showToast('Cleared network highlight', 'info');
      return;
    }

    const connectedCardIds = new Set([startCardId]);
    const connectedConnIds = new Set();
    const queue = [startCardId];

    while (queue.length > 0) {
      const currentId = queue.shift();

      connections.forEach((conn) => {
        if (conn.fromCardId === currentId || conn.toCardId === currentId) {
          connectedConnIds.add(conn.id);
          const neighborId = conn.fromCardId === currentId ? conn.toCardId : conn.fromCardId;
          if (!connectedCardIds.has(neighborId)) {
            connectedCardIds.add(neighborId);
            queue.push(neighborId);
          }
        }
      });
    }

    const cardDepths = {};
    connectedCardIds.forEach((id) => { cardDepths[id] = 0; });

    setHighlightedPathStartCardId(startCardId);
    setHighlightedPathCardDepths(cardDepths);
    setHighlightedPathConnectionIds(Array.from(connectedConnIds));

    showToast(
      `Highlighted network: ${connectedCardIds.size} card(s) & ${connectedConnIds.size} connection(s)`,
      'success'
    );
  };

  const handleHighlightByCustomId = (targetIdStr) => {
    const cleanId = String(targetIdStr || '').trim();
    if (!cleanId) {
      showToast('Please set an ID on this node first before highlighting!', 'info');
      return;
    }

    // Toggle OFF if already highlighted for this ID
    if (highlightedPathStartCardId === 'id_group' && activeHighlightedCustomId === cleanId) {
      handleClearHighlight();
      showToast(`Cleared highlight for ID: "${cleanId}"`, 'info');
      return;
    }

    const matchingCardIds = new Set();
    const matchingConnIds = new Set();

    cards.forEach((c) => {
      // Support node having multiple IDs stored in array or string list
      const ids = Array.isArray(c.highlightIds)
        ? c.highlightIds
        : Array.isArray(c.highlightId)
        ? c.highlightId
        : String(c.highlightId || '').split(/[, ]+/).filter(Boolean);

      if (ids.some((id) => String(id).trim() === cleanId)) {
        matchingCardIds.add(c.id);
      }
    });

    connections.forEach((conn) => {
      const connIds = Array.isArray(conn.customIds)
        ? conn.customIds
        : Array.isArray(conn.customId)
        ? conn.customId
        : String(conn.customId || '').split(/[, ]+/).filter(Boolean);

      if (connIds.some((id) => String(id).trim() === cleanId)) {
        matchingConnIds.add(conn.id);
        matchingCardIds.add(conn.fromCardId);
        matchingCardIds.add(conn.toCardId);
      }
    });

    if (matchingCardIds.size === 0 && matchingConnIds.size === 0) {
      showToast(`No nodes found sharing ID: "${cleanId}"`, 'info');
      return;
    }

    const cardDepths = {};
    matchingCardIds.forEach((id) => { cardDepths[id] = 0; });

    setHighlightedPathStartCardId('id_group');
    setActiveHighlightedCustomId(cleanId);
    setHighlightedPathCardDepths(cardDepths);
    setHighlightedPathConnectionIds(Array.from(matchingConnIds));

    showToast(
      `Highlighted ${matchingCardIds.size} node(s) & ${matchingConnIds.size} connection(s) sharing ID: "${cleanId}"`,
      'success'
    );
  };

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
    const saved = getDraggItem('keybindings', null);
    if (saved) return saved;
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



  const getBoardEndpoint = () => {
    return `${API_BASE}/board/${boardId}`;
  };

  const [boardPreset, setBoardPreset] = useState(() => (boardId.startsWith('sd_') ? 'system_design' : 'freestyle'));

  // Load board details
  useEffect(() => {
    const fetchBoardDetails = async () => {
      try {
        let endpoint = getBoardEndpoint();
        let res = await fetch(endpoint, {
          headers: {
            'x-board-password': localPassword
          }
        });
        if (res.status === 401) {
          setShowUnlockModal(true);
          return;
        }
        if (!res.ok) throw new Error('Board not found');
        const data = await res.json();

        const rawCards = (data.cards || []).map((c, i) => ({
          ...c,
          id: c.id || (c._id ? String(c._id) : `card_${i}_${Math.random().toString(36).substring(2, 7)}`)
        }));

        setBoardName(data.name || 'Untitled Board');
        setBoardPreset(data.preset || (boardId.startsWith('sd_') ? 'system_design' : 'freestyle'));
        setCards(rawCards);
        setConnections(data.connections || []);
        setDrawings(data.drawings || []);

        if (rawCards.length > 0) {
          const xs = rawCards.map(c => c.x || 0);
          const ys = rawCards.map(c => c.y || 0);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);

          if (!data.pan || (data.pan.x === 0 && data.pan.y === 0) || (data.pan.x === 100 && data.pan.y === 100 && minX < -500)) {
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            setPan({
              x: window.innerWidth / 2 - centerX,
              y: window.innerHeight / 2 - centerY
            });
          } else {
            setPan(data.pan || { x: 100, y: 100 });
          }
        } else {
          setPan(data.pan || { x: 100, y: 100 });
        }
        setZoom(data.zoom || 1.0);
        setProtectionMode(data.protectionMode || 'none');
        setBoardCode(data.code || '');
        setBoardLanguage(data.language || 'javascript');
        setHighlightedPathStartCardId(data.highlightedPathStartCardId || '');
        setBoardBgColor(data.boardBgColor || '#0a0a0c');
        setLiveBgStyle(data.liveBgStyle || 'none');
        if (data.toolbarSettings) {
          setToolbarSettings(data.toolbarSettings);
        } else {
          setToolbarSettings({
            position: { x: 20, y: window.innerHeight / 2 - 200 },
            orientation: 'vertical'
          });
        }

        lastSavedStateRef.current = {
          boardName: data.name || 'Untitled Board',
          cards: JSON.parse(JSON.stringify(data.cards || [])),
          connections: JSON.parse(JSON.stringify(data.connections || [])),
          drawings: JSON.parse(JSON.stringify(data.drawings || [])),
          pan: JSON.parse(JSON.stringify(data.pan || { x: 100, y: 100 })),
          zoom: data.zoom || 1.0,
          boardCode: data.code || '',
          boardLanguage: data.language || 'javascript',
          highlightedPathStartCardId: data.highlightedPathStartCardId || '',
          boardBgColor: data.boardBgColor || '#0a0a0c',
          liveBgStyle: data.liveBgStyle || 'none',
          toolbarSettings: data.toolbarSettings || { position: { x: 20, y: window.innerHeight / 2 - 200 }, orientation: 'vertical' }
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
  }, [boardId, localPassword]);

  const [isClipboardSliderOpen, setIsClipboardSliderOpen] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);

  const handleCopyToDraggClipboard = async (cardIdToCopy = null) => {
    let targetCardIds = [];
    if (cardIdToCopy) {
      if (selectedCardIds.includes(cardIdToCopy) && selectedCardIds.length > 1) {
        targetCardIds = selectedCardIds;
      } else {
        targetCardIds = [cardIdToCopy];
      }
    } else if (selectedCardIds.length > 0) {
      targetCardIds = selectedCardIds;
    }

    if (targetCardIds.length === 0) {
      showToast('Select card(s) to copy to Dragg Clipboard', 'error');
      return;
    }

    const cardsToCopy = cards.filter(c => targetCardIds.includes(c.id));

    // Try capturing a low-res image screenshot thumbnail of target DOM card
    let previewImage = null;
    try {
      let targetEl = null;
      if (targetCardIds.length === 1) {
        targetEl = document.querySelector(`[data-card-id="${targetCardIds[0]}"]`);
      } else {
        targetEl = document.querySelector('.group-selection-container') || containerRef.current;
      }

      if (targetEl) {
        previewImage = await toJpeg(targetEl, {
          quality: 0.35,
          pixelRatio: 0.6,
          backgroundColor: boardBgColor || '#0a0a0c',
          cacheBust: true
        }).catch(() => null);
      }
    } catch (err) {
      console.warn('Screenshot preview fallback:', err);
    }

    const newItem = copyToDraggClipboard(cardsToCopy, connections, boardPreset, previewImage);
    if (newItem) {
      showToast(`Saved to Dragg Clipboard (${newItem.cardCount} card${newItem.cardCount > 1 ? 's' : ''})`);
    }
  };

  const handlePasteFromDraggClipboard = (item) => {
    if (!item || !item.cards || item.cards.length === 0) return;

    const idMap = {};
    const newCardIds = [];

    // Calculate bounding center offset
    const pastedCards = item.cards.map((c) => {
      const newId = (c.type === 'system_node' ? 'sys_' : 'card_') + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      idMap[c.id] = newId;
      newCardIds.push(newId);
      return {
        ...c,
        id: newId,
        x: (c.x || 0) + 40,
        y: (c.y || 0) + 40,
        _id: undefined
      };
    });

    // Remap group IDs if applicable
    pastedCards.forEach(c => {
      if (c.groupId && idMap[c.groupId]) {
        c.groupId = idMap[c.groupId];
      }
    });

    // Map connections between the pasted cards
    const pastedConnections = (item.connections || []).map((conn) => {
      return {
        ...conn,
        id: 'conn_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        fromCardId: idMap[conn.fromCardId] || conn.fromCardId,
        toCardId: idMap[conn.toCardId] || conn.toCardId,
        _id: undefined
      };
    });

    const updatedCardsList = [...cards, ...pastedCards];
    const updatedConnList = [...connections, ...pastedConnections];

    setCards(updatedCardsList);
    setConnections(updatedConnList);
    setSelectedCardIds(newCardIds);

    // Save state
    saveBoardState(updatedCardsList, updatedConnList);

    if (showToast) {
      showToast(`Pasted ${pastedCards.length} card(s) from Dragg Clipboard!`);
    }
  };

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
      } else {
        // Check custom keymapping presets (case-insensitive)
        const pressedKey = e.key.toLowerCase();
        const matchedPreset = stylePresets.find(p => p.key.toLowerCase() === pressedKey);
        if (matchedPreset) {
          // Check if preset is already active
          const isCurrentlyActive =
            (!matchedPreset.toolMode || toolMode === matchedPreset.toolMode) &&
            (!matchedPreset.connectorStyle || activeConnectorStyle === matchedPreset.connectorStyle) &&
            (!matchedPreset.connectorAnimation || activeConnectorAnimation === matchedPreset.connectorAnimation) &&
            (!matchedPreset.connectorColor || activeConnectorColor === matchedPreset.connectorColor) &&
            (!matchedPreset.connectorThickness || activeConnectorThickness === matchedPreset.connectorThickness) &&
            (!matchedPreset.penColor || penColor === matchedPreset.penColor) &&
            (!matchedPreset.penThickness || penThickness === matchedPreset.penThickness) &&
            (!matchedPreset.gridType || gridType === matchedPreset.gridType) &&
            (!matchedPreset.boardBgColor || boardBgColor === matchedPreset.boardBgColor) &&
            (!matchedPreset.liveBgStyle || liveBgStyle === matchedPreset.liveBgStyle) &&
            (!matchedPreset.cursorStyle || cursorStyle === matchedPreset.cursorStyle);

          if (isCurrentlyActive) {
            // Revert back to default styles
            setToolMode('select');
            setActiveConnectorStyle('default');
            setActiveConnectorAnimation('none');
            setActiveConnectorColor('auto');
            setActiveConnectorThickness(2.5);
            setPenColor('#ffffff');
            setPenThickness(5);
            setGridType('none');
            setBoardBgColor('#0a0a0c');
            setLiveBgStyle('none');
            setCursorStyle('default');
            showToast('Reverted styles to defaults');
          } else {
            // Apply preset styles
            if (matchedPreset.toolMode) setToolMode(matchedPreset.toolMode);
            if (matchedPreset.connectorStyle) setActiveConnectorStyle(matchedPreset.connectorStyle);
            if (matchedPreset.connectorAnimation) setActiveConnectorAnimation(matchedPreset.connectorAnimation);
            if (matchedPreset.connectorColor) setActiveConnectorColor(matchedPreset.connectorColor);
            if (matchedPreset.connectorThickness) setActiveConnectorThickness(matchedPreset.connectorThickness);
            if (matchedPreset.penColor) setPenColor(matchedPreset.penColor);
            if (matchedPreset.penThickness) setPenThickness(matchedPreset.penThickness);
            if (matchedPreset.gridType) setGridType(matchedPreset.gridType);
            if (matchedPreset.boardBgColor) setBoardBgColor(matchedPreset.boardBgColor);
            if (matchedPreset.liveBgStyle) setLiveBgStyle(matchedPreset.liveBgStyle);
            if (matchedPreset.cursorStyle) setCursorStyle(matchedPreset.cursorStyle);
            showToast(`Preset Active: ${matchedPreset.name}!`, 'success');
          }
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    keybindings,
    stylePresets,
    toolMode,
    activeConnectorStyle,
    activeConnectorAnimation,
    activeConnectorColor,
    activeConnectorThickness,
    penColor,
    penThickness,
    gridType,
    boardBgColor,
    liveBgStyle,
    cursorStyle
  ]);

  // Reference to track the latest canvas state variables to avoid resetting intervals
  const latestDataRef = useRef({ boardName, cards, connections, drawings, pan, zoom, boardCode, boardLanguage, highlightedPathStartCardId, boardBgColor, liveBgStyle, toolbarSettings });
  useEffect(() => {
    latestDataRef.current = { boardName, cards, connections, drawings, pan, zoom, boardCode, boardLanguage, highlightedPathStartCardId, boardBgColor, liveBgStyle, toolbarSettings };
  }, [boardName, cards, connections, drawings, pan, zoom, boardCode, boardLanguage, highlightedPathStartCardId, boardBgColor, liveBgStyle, toolbarSettings]);

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
        boardName: '', cards: [], connections: [], drawings: [], pan: { x: 0, y: 0 }, zoom: 1, boardCode: '', boardLanguage: '', highlightedPathStartCardId: '', boardBgColor: '#0a0a0c', liveBgStyle: 'none', toolbarSettings: { position: { x: 20, y: 200 }, orientation: 'vertical' }
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
      if (current.highlightedPathStartCardId !== saved.highlightedPathStartCardId) {
        deltaPayload.highlightedPathStartCardId = current.highlightedPathStartCardId;
      }
      if (current.boardBgColor !== saved.boardBgColor) {
        deltaPayload.boardBgColor = current.boardBgColor;
      }
      if (current.liveBgStyle !== saved.liveBgStyle) {
        deltaPayload.liveBgStyle = current.liveBgStyle;
      }
      if (JSON.stringify(current.toolbarSettings) !== JSON.stringify(saved.toolbarSettings)) {
        deltaPayload.toolbarSettings = current.toolbarSettings;
      }

      if (Object.keys(deltaPayload).length === 0) {
        setSaveStatus('saved');
        setHasUnsavedChanges(false);
        setShouldGlowAlert(false);
        unsavedSinceRef.current = null;
        return;
      }

      let res = await fetch(`${API_BASE}/board/${boardId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-board-password': localPassword
        },
        body: JSON.stringify(deltaPayload),
      });

      // If PATCH is not supported by endpoint, fallback to PUT full payload
      if (!res.ok && (res.status === 405 || res.status === 404)) {
        res = await fetch(`${API_BASE}/board/${boardId}`, {
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
            highlightedPathStartCardId: current.highlightedPathStartCardId,
            boardBgColor: current.boardBgColor,
            liveBgStyle: current.liveBgStyle,
            toolbarSettings: current.toolbarSettings
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

  // Download board data as clean JSON document excluding board name, password, and document metadata
  const handleExportJSON = () => {
    try {
      const cleanCards = (cards || []).map((c) => {
        const { _id, isPartialProtected, protectionMode, createdAt, updatedAt, __v, name, password, ...rest } = c;
        return {
          ...rest,
          id: rest.id || (_id ? String(_id) : undefined)
        };
      });

      const cleanConnections = (connections || []).map((conn) => {
        const { _id, createdAt, updatedAt, __v, ...rest } = conn;
        return { ...rest };
      });

      const cleanDrawings = (drawings || []).map((dw) => {
        const { _id, createdAt, updatedAt, __v, ...rest } = dw;
        return { ...rest };
      });

      const exportData = {
        preset: boardPreset || 'freestyle',
        language: boardLanguage || 'javascript',
        code: boardCode || '',
        boardBgColor: boardBgColor || '#0a0a0c',
        liveBgStyle: liveBgStyle || 'none',
        pan: pan || { x: 0, y: 0 },
        zoom: zoom || 1,
        toolbarSettings: toolbarSettings || {},
        stylePresets: stylePresets || [],
        cards: cleanCards,
        connections: cleanConnections,
        drawings: cleanDrawings
      };

      const sanitizedName = (boardName || 'whiteboard')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const fileName = `${sanitizedName || 'whiteboard'}-export.json`;
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast('Board JSON exported successfully!', 'success');
    } catch (err) {
      console.error('Failed to export JSON:', err);
      showToast('Error exporting JSON: ' + err.message, 'error');
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
  }, [cards, connections, drawings, boardName, pan, zoom, boardCode, boardLanguage, highlightedPathStartCardId, boardBgColor, liveBgStyle, toolbarSettings, hasUnsavedChanges, isViewOnly, autoSaveEnabled]);

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
  }, [cards, connections, drawings, boardName, pan, zoom, boardCode, boardLanguage, highlightedPathStartCardId, boardBgColor, liveBgStyle, toolbarSettings]);

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
    if (e.pointerType === 'mouse' && e.button !== 0) return; // Left click only for mouse

    if (pendingPlacementCard) {
      if (e.target.closest('.modal-content') || e.target.closest('.vertical-toolbar-container')) return;
      e.stopPropagation();
      e.preventDefault();
      const placedCard = {
        ...pendingPlacementCard,
        x: placementPos.x,
        y: placementPos.y,
      };
      setCards((prev) => [...prev, placedCard]);
      setSelectedCardId(placedCard.id);
      setPendingPlacementCard(null);
      showToast(`${placedCard.title || 'Card'} placed!`, 'success');
      return;
    }

    // DRAFT CONNECTION WAYPOINT PLACEMENT ON CANVAS CLICK
    if (draftConnectionRef.current) {
      const clickedCardWrapper = e.target.closest('.card-wrapper');
      if (clickedCardWrapper) {
        const clickedCardId = clickedCardWrapper.getAttribute('data-card-id');
        if (clickedCardId && clickedCardId !== draftConnectionRef.current.fromCardId) {
          handleStartConnection(clickedCardId, 'connector', e);
          return;
        }
      }

      if (e.target.closest('.toolbar-container') || e.target.closest('.vertical-toolbar-container')) {
        return;
      }

      // Clicking canvas cancels draft connection
      setDraftConnection(null);
      draftConnectionRef.current = null;
      return;
    }

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
        document.removeEventListener('pointermove', handleMouseMove);
        document.removeEventListener('pointerup', handleMouseUp);
      };

      document.addEventListener('pointermove', handleMouseMove);
      document.addEventListener('pointerup', handleMouseUp);
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
        document.removeEventListener('pointermove', handleMouseMove);
        document.removeEventListener('pointerup', handleMouseUp);
      };

      document.addEventListener('pointermove', handleMouseMove);
      document.addEventListener('pointerup', handleMouseUp);
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
          document.removeEventListener('pointermove', handleMouseMove);
          document.removeEventListener('pointerup', handleMouseUp);
        };

        isPanningRef.current = true;
        document.addEventListener('pointermove', handleMouseMove);
        document.addEventListener('pointerup', handleMouseUp);
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
        document.removeEventListener('pointermove', handleMouseMove);
        document.removeEventListener('pointerup', handleMouseUp);
      };

      document.addEventListener('pointermove', handleMouseMove);
      document.addEventListener('pointerup', handleMouseUp);
    }
  };

  // Zoom on wheel (relative to cursor)
  const handleWheel = (e) => {
    if (
      e.target.closest('.outline-sidebar-panel') ||
      e.target.closest('.code-split-panel') ||
      e.target.closest('.card-wrapper') ||
      e.target.closest('.tiptap-toolbar') ||
      e.target.closest('.tiptap-content-area') ||
      e.target.closest('.card-body')
    ) {
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
    setCardNodeLayout('four-node');
    setShowAddCardModal(true);
  };

  const handleAddCardDirect = (cardType) => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to add cards.', 'error');
      return;
    }

    let width = 250;
    let height = 180;
    let cardMode = 'notes';
    let type = 'note';
    let features = {
      notes: true,
      sketch: false,
      attachments: false,
      tags: false,
      colorPalette: true,
      completedStatus: true,
      connectPorts: true
    };

    if (cardType === 'minimal') {
      width = 200;
      height = 50;
      features = {
        notes: false,
        sketch: false,
        attachments: false,
        tags: false,
        colorPalette: false,
        completedStatus: false,
        connectPorts: true
      };
    } else if (cardType === 'sketch') {
      cardMode = 'sketch';
      features = {
        notes: false,
        sketch: true,
        attachments: false,
        tags: false,
        colorPalette: true,
        completedStatus: true,
        connectPorts: true
      };
    } else if (cardType === 'code') {
      cardMode = 'code';
      features = {
        notes: false,
        sketch: false,
        attachments: false,
        tags: true,
        colorPalette: true,
        completedStatus: true,
        connectPorts: true
      };
    } else if (cardType === 'image') {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          handleUploadImage(event.target.result);
        };
        reader.readAsDataURL(file);
      };
      fileInput.click();
      return;
    }

    let spawnX = 150;
    let spawnY = 150;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const centerCoords = screenToCanvas(
        rect.left + rect.width / 2 - (width * zoom) / 2,
        rect.top + rect.height / 2 - (height * zoom) / 2
      );
      spawnX = centerCoords.x;
      spawnY = centerCoords.y;
    }

    const newCard = {
      id: Math.random().toString(36).substring(2, 11),
      x: spawnX,
      y: spawnY,
      width,
      height,
      title: cardType === 'minimal' ? 'Minimal Card' : 'Untitled Note',
      content: '',
      tags: [],
      color: 'slate',
      type,
      cardMode,
      features,
      nodeLayout: cardNodeLayout
    };

    startCardPlacement(newCard);
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
      title: 'Minimal Card',
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
      },
      nodeLayout: 'four-node'
    };

    startCardPlacement(newCard);
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
      title: !hasBodyContent ? 'Minimal Card' : 'Untitled Note',
      content: '',
      tags: [],
      color: 'slate',
      type: 'note',
      cardMode,
      features: { ...cardFeatures },
      nodeLayout: cardNodeLayout
    };

    setShowAddCardModal(false);
    startCardPlacement(newCard);
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

    startCardPlacement(newImageCard);
  };

  // Update card values (supports group movement delta when multiple cards selected)
  const handleUpdateCard = (cardId, updatedFields) => {
    if (isViewOnly) return;

    // Check if card is being resized or layout toggled
    const cardToUpdate = cardsRef.current.find((c) => c.id === cardId);
    if (cardToUpdate) {
      if ('width' in updatedFields || 'height' in updatedFields) {
        const oldWidth = cardToUpdate.width || 250;
        const oldHeight = cardToUpdate.height || 200;
        const newWidth = updatedFields.width !== undefined ? updatedFields.width : oldWidth;
        const newHeight = updatedFields.height !== undefined ? updatedFields.height : oldHeight;

        if (oldWidth !== newWidth || oldHeight !== newHeight) {
          setConnections((prevConns) =>
            prevConns.map((conn) => {
              let updated = false;
              const newConn = { ...conn };

              if (conn.fromCardId === cardId) {
                if (conn.fromOffsetX !== undefined) {
                  newConn.fromOffsetX = oldWidth > 0 ? (conn.fromOffsetX / oldWidth) * newWidth : conn.fromOffsetX;
                  updated = true;
                }
                if (conn.fromOffsetY !== undefined) {
                  newConn.fromOffsetY = oldHeight > 0 ? (conn.fromOffsetY / oldHeight) * newHeight : conn.fromOffsetY;
                  updated = true;
                }
              }

              if (conn.toCardId === cardId) {
                if (conn.toOffsetX !== undefined) {
                  newConn.toOffsetX = oldWidth > 0 ? (conn.toOffsetX / oldWidth) * newWidth : conn.toOffsetX;
                  updated = true;
                }
                if (conn.toOffsetY !== undefined) {
                  newConn.toOffsetY = oldHeight > 0 ? (conn.toOffsetY / oldHeight) * newHeight : conn.toOffsetY;
                  updated = true;
                }
              }

              return updated ? newConn : conn;
            })
          );
        }
      }

      if ('nodeLayout' in updatedFields) {
        const newLayout = updatedFields.nodeLayout;
        setConnections((prevConns) =>
          prevConns.map((conn) => {
            let updated = false;
            const newConn = { ...conn };

            if (conn.fromCardId === cardId) {
              if (newLayout === 'four-node' && conn.fromSide === 'freestyle') {
                const x = cardToUpdate.x + (conn.fromOffsetX || 0);
                const y = cardToUpdate.y + (conn.fromOffsetY || 0);
                newConn.fromSide = getLogicalSide(cardToUpdate, { x, y });
                newConn.fromOffsetX = undefined;
                newConn.fromOffsetY = undefined;
                updated = true;
              } else if (newLayout === 'freestyle' && conn.fromSide !== 'freestyle') {
                const coords = getPortCoords(cardToUpdate, conn.fromSide);
                newConn.fromSide = 'freestyle';
                newConn.fromOffsetX = coords.x - cardToUpdate.x;
                newConn.fromOffsetY = coords.y - cardToUpdate.y;
                updated = true;
              }
            }

            if (conn.toCardId === cardId) {
              if (newLayout === 'four-node' && conn.toSide === 'freestyle') {
                const x = cardToUpdate.x + (conn.toOffsetX || 0);
                const y = cardToUpdate.y + (conn.toOffsetY || 0);
                newConn.toSide = getLogicalSide(cardToUpdate, { x, y });
                newConn.toOffsetX = undefined;
                newConn.toOffsetY = undefined;
                updated = true;
              } else if (newLayout === 'freestyle' && conn.toSide !== 'freestyle') {
                const coords = getPortCoords(cardToUpdate, conn.toSide);
                newConn.toSide = 'freestyle';
                newConn.toOffsetX = coords.x - cardToUpdate.x;
                newConn.toOffsetY = coords.y - cardToUpdate.y;
                updated = true;
              }
            }

            return updated ? newConn : conn;
          })
        );
      }
    }

    setCards((prev) => {
      const cardToUpdate = prev.find((c) => c.id === cardId);
      if (!cardToUpdate) return prev;

      // Group Dissolution
      if (updatedFields.dissolveGroup) {
        setTimeout(() => showToast('Group dissolved successfully.'), 50);
        return prev
          .filter((c) => c.id !== cardId)
          .map((c) => (c.groupId === cardId ? { ...c, groupId: '' } : c));
      }

      // Group entity synchronous movement (dragging any card in group or group container moves everything)
      const groupId = cardToUpdate.groupId || (cardToUpdate.type === 'group' ? cardToUpdate.id : null);
      if ('x' in updatedFields && 'y' in updatedFields && groupId) {
        const dx = updatedFields.x - cardToUpdate.x;
        const dy = updatedFields.y - cardToUpdate.y;
        if (dx === 0 && dy === 0) return prev;

        return prev.map((c) => {
          if (c.groupId === groupId || c.id === groupId) {
            return { ...c, x: c.x + dx, y: c.y + dy };
          }
          return c;
        });
      }

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

    const lockedCards = cards.filter(c => {
      if (!idsToDelete.includes(c.id)) return false;
      if (c.isLocked) return true;
      if (c.groupId) {
        const parentGroup = cards.find(g => g.id === c.groupId);
        if (parentGroup && parentGroup.isLocked) return true;
      }
      return false;
    });
    if (lockedCards.length > 0) {
      showToast('Cannot delete locked items or items inside locked groups. Unlock them first.', 'error');
      return;
    }

    setCards((prev) => prev.filter((c) => !idsToDelete.includes(c.id)));
    setConnections((prev) =>
      prev.filter((conn) => !idsToDelete.includes(conn.fromCardId) && !idsToDelete.includes(conn.toCardId))
    );
    setSelectedCardIds([]);
    showToast(`${idsToDelete.length > 1 ? `${idsToDelete.length} items` : 'Item'} deleted.`);
  };

  const handleGroupSelectedCards = () => {
    if (selectedCardIds.length < 2) return;

    const selectedNormalCards = cards.filter(c => selectedCardIds.includes(c.id) && c.type !== 'group');
    if (selectedNormalCards.length < 2) {
      showToast('Need at least 2 non-group cards to group.', 'error');
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    selectedNormalCards.forEach(c => {
      const w = c.width || 250;
      const h = c.height || 200;
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x + w > maxX) maxX = c.x + w;
      if (c.y + h > maxY) maxY = c.y + h;
    });

    const padding = 35;
    const groupX = minX - padding;
    const groupY = minY - padding;
    const groupWidth = (maxX - minX) + 2 * padding;
    const groupHeight = (maxY - minY) + 2 * padding;

    const newGroupId = `group-${Date.now()}`;
    const newGroupCard = {
      id: newGroupId,
      x: groupX,
      y: groupY,
      width: groupWidth,
      height: groupHeight,
      title: 'New Group',
      content: '',
      color: 'slate',
      type: 'group',
      showInSearch: false,
      isLocked: false,
      groupId: ''
    };

    setCards(prev => {
      const updatedNormalCards = prev.map(c => {
        if (selectedCardIds.includes(c.id) && c.type !== 'group') {
          return { ...c, groupId: newGroupId };
        }
        return c;
      });
      return [newGroupCard, ...updatedNormalCards];
    });

    setSelectedCardIds([]);
    showToast('Cards grouped successfully.');
  };

  const handleViewPath = (startCardId) => {
    setHighlightedPathStartCardId(startCardId);
    showToast('Highlighting downstream path...');
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

      if (e.key === 'Escape') {
        if (draftConnectionRef.current) {
          setDraftConnection(null);
          draftConnectionRef.current = null;
          showToast('Connection placement cancelled.', 'info');
        }
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
  const handleStartConnection = (cardId, fromSideInput, e) => {
    if (isViewOnly) {
      showToast('Board is locked. Enter password to connect cards.', 'error');
      return;
    }

    if (justFinishedDraftRef.current) return;

    // IF A DRAFT CONNECTION IS ALREADY ACTIVE AND USER CLICKS ANOTHER CARD (Card B):
    if (draftConnectionRef.current && draftConnectionRef.current.fromCardId !== cardId) {
      const activeDraft = draftConnectionRef.current;
      const targetCard = cards.find((c) => c.id === cardId);
      if (targetCard) {
        const initialCanvasCoords = screenToCanvas(e.clientX, e.clientY);
        const isTargetFreestyle = targetCard.nodeLayout === 'freestyle';
        const targetSide = fromSideInput === 'connector' ? getClosestSide(targetCard, initialCanvasCoords) : (fromSideInput || 'left');

        const rectB = {
          left: targetCard.x,
          top: targetCard.y,
          right: targetCard.x + (targetCard.width || 250),
          bottom: targetCard.y + (targetCard.height || 200)
        };
        const endPort = targetSide === 'freestyle'
          ? getClosestPointOnRectBorder(initialCanvasCoords, rectB)
          : getPortCoords(targetCard, targetSide);
        const toOffsetX = endPort.x - targetCard.x;
        const toOffsetY = endPort.y - targetCard.y;

        const newConnection = {
          id: Math.random().toString(36).substring(2, 9),
          fromCardId: activeDraft.fromCardId,
          fromSide: activeDraft.fromSide,
          toCardId: targetCard.id,
          toSide: targetSide,
          fromOffsetX: activeDraft.fromOffsetX,
          fromOffsetY: activeDraft.fromOffsetY,
          toOffsetX,
          toOffsetY,
          label: '',
          style: activeConnectorStyle,
          color: activeConnectorColor,
          animation: activeConnectorAnimation,
          thickness: activeConnectorThickness,
          waypoints: activeDraft.waypoints || [],
        };

        setConnections((prev) => [...prev, newConnection]);
        setDraftConnection(null);
        draftConnectionRef.current = null;
        justFinishedDraftRef.current = true;
        setTimeout(() => { justFinishedDraftRef.current = false; }, 350);
        showToast('Cards connected maintaining your custom path!', 'success');
        return;
      }
    }

    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    const initialCanvasCoords = screenToCanvas(e.clientX, e.clientY);
    const fromSide = fromSideInput === 'connector' ? getClosestSide(card, initialCanvasCoords) : fromSideInput;

    const rectA = {
      left: card.x,
      top: card.y,
      right: card.x + (card.width || 250),
      bottom: card.y + (card.height || 200)
    };
    const startPort = fromSide === 'freestyle' ? getClosestPointOnRectBorder(initialCanvasCoords, rectA) : getPortCoords(card, fromSide);
    const fromOffsetX = startPort.x - card.x;
    const fromOffsetY = startPort.y - card.y;

    const initDraft = {
      fromCardId: cardId,
      fromSide,
      start: startPort,
      current: startPort,
      waypoints: [],
      fromOffsetX,
      fromOffsetY
    };
    setDraftConnection(initDraft);
    draftConnectionRef.current = initDraft;

    const handleMouseMove = (moveEvent) => {
      const canvasCoords = screenToCanvas(moveEvent.clientX, moveEvent.clientY);
      if (draftConnectionRef.current) {
        const updated = { ...draftConnectionRef.current, current: canvasCoords };
        draftConnectionRef.current = updated;
        setDraftConnection(updated);
      }
    };

    const handleMouseUp = (upEvent) => {
      if (justFinishedDraftRef.current || !draftConnectionRef.current) {
        document.removeEventListener('pointermove', handleMouseMove);
        document.removeEventListener('pointerup', handleMouseUp);
        return;
      }

      const canvasCoords = screenToCanvas(upEvent.clientX, upEvent.clientY);

      const targetCard = cards.find((c) => {
        if (c.id === cardId || c.type === 'group') return false;
        const w = c.width || 250;
        const h = c.height || 200;
        return (
          canvasCoords.x >= c.x - 20 &&
          canvasCoords.x <= c.x + w + 20 &&
          canvasCoords.y >= c.y - 20 &&
          canvasCoords.y <= c.y + h + 20
        );
      });

      if (targetCard) {
        const isTargetFreestyle = targetCard.nodeLayout === 'freestyle';
        const targetSide = isTargetFreestyle ? 'freestyle' : getClosestSide(targetCard, canvasCoords);

        const rectB = {
          left: targetCard.x,
          top: targetCard.y,
          right: targetCard.x + (targetCard.width || 250),
          bottom: targetCard.y + (targetCard.height || 200)
        };
        const endPort = targetSide === 'freestyle'
          ? getClosestPointOnRectBorder(canvasCoords, rectB)
          : getPortCoords(targetCard, targetSide);

        const toOffsetX = endPort.x - targetCard.x;
        const toOffsetY = endPort.y - targetCard.y;

        const exists = !isTargetFreestyle && fromSide !== 'freestyle' && connections.some(
          (conn) =>
            (conn.fromCardId === cardId && conn.fromSide === fromSide && conn.toCardId === targetCard.id && conn.toSide === targetSide) ||
            (conn.fromCardId === targetCard.id && conn.fromSide === targetSide && conn.toCardId === cardId && conn.toSide === fromSide)
        );

        if (!exists) {
          const currentWaypoints = draftConnectionRef.current?.waypoints || [];
          const newConnection = {
            id: Math.random().toString(36).substring(2, 9),
            fromCardId: cardId,
            fromSide: fromSide,
            toCardId: targetCard.id,
            toSide: targetSide,
            fromOffsetX,
            fromOffsetY,
            toOffsetX,
            toOffsetY,
            label: '',
            style: activeConnectorStyle,
            color: activeConnectorColor,
            animation: activeConnectorAnimation,
            thickness: activeConnectorThickness,
            waypoints: currentWaypoints,
          };
          setConnections((prev) => [...prev, newConnection]);
          showToast('Cards connected successfully!');
        } else {
          showToast('Connection already exists between these ports.', 'error');
        }

        setDraftConnection(null);
        draftConnectionRef.current = null;
        justFinishedDraftRef.current = true;
        setTimeout(() => { justFinishedDraftRef.current = false; }, 350);
        document.removeEventListener('pointermove', handleMouseMove);
        document.removeEventListener('pointerup', handleMouseUp);
      }
    };

    document.addEventListener('pointermove', handleMouseMove);
    document.addEventListener('pointerup', handleMouseUp);
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

  const getLogicalSide = (card, point) => {
    if (!card) return 'right';
    const w = card.width || 250;
    const h = card.height || 200;
    const relX = point.x - card.x;
    const relY = point.y - card.y;

    const distL = Math.max(0, relX);
    const distR = Math.max(0, w - relX);
    const distT = Math.max(0, relY);
    const distB = Math.max(0, h - relY);

    const minDist = Math.min(distL, distR, distT, distB);
    if (minDist === distL) return 'left';
    if (minDist === distR) return 'right';
    if (minDist === distT) return 'top';
    return 'bottom';
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

  // Smooth Spline Path generator: curved path through waypoints
  const getSmoothWaypointsPath = (points) => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    if (points.length === 2) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;

    const k = 0.25;
    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) * k;
      const cp1y = p1.y + (p2.y - p0.y) * k;
      const cp2x = p2.x - (p3.x - p1.x) * k;
      const cp2y = p2.y - (p3.y - p1.y) * k;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    return d;
  };

  // Straight Waypoint Path generator: connects waypoints with straight line segments
  const getWaypointsPath = (points) => {
    if (!points || points.length === 0) return '';
    return points.reduce((acc, p, idx) => {
      const x = p.x.toFixed(1);
      const y = p.y.toFixed(1);
      return acc + (idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`);
    }, '');
  };

  // Path SVG builder and midpoint calculator for connections
  const getPathProperties = (from, to, sideA, sideB, style, cardA, cardB, waypoints) => {
    if (waypoints && waypoints.length > 0) {
      const allPoints = [from, ...waypoints, to];
      const pathStr = (style === 'default' || style === 'curve') ? getSmoothWaypointsPath(allPoints) : getWaypointsPath(allPoints);
      const midIdx = Math.floor(allPoints.length / 2);
      const midpoint = allPoints[midIdx] || { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
      return { pathStr, midpoint, debugCandidates: [] };
    }


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

    if (style === 'smooth-90') {
      const r = 12; // corner radius
      const margin = 24; // buffer margin for routing around cards

      let resolvedSideA = sideA;
      if (sideA === 'freestyle') {
        resolvedSideA = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
          ? (to.x >= from.x ? 'right' : 'left')
          : (to.y >= from.y ? 'bottom' : 'top');
      }

      let resolvedSideB = sideB;
      if (sideB === 'center' || sideB === 'freestyle') {
        if (resolvedSideA === 'right' || resolvedSideA === 'left') {
          resolvedSideB = (to.x >= from.x) ? 'left' : 'right';
        } else {
          resolvedSideB = (to.y >= from.y) ? 'top' : 'bottom';
        }
      }

      // Compute bounding boxes for cardA and cardB (expanded obstacles)
      const rectA = cardA ? {
        left: cardA.x,
        top: cardA.y,
        right: cardA.x + (cardA.width || 250),
        bottom: cardA.y + (cardA.height || 200)
      } : null;

      const rectB = cardB ? {
        left: cardB.x,
        top: cardB.y,
        right: cardB.x + (cardB.width || 250),
        bottom: cardB.y + (cardB.height || 200)
      } : null;

      // Exit port direction offsets
      let pA = { ...from };
      if (resolvedSideA === 'right') pA.x += margin;
      else if (resolvedSideA === 'left') pA.x -= margin;
      else if (resolvedSideA === 'bottom') pA.y += margin;
      else if (resolvedSideA === 'top') pA.y -= margin;

      let pB = { ...to };
      if (resolvedSideB === 'right') pB.x += margin;
      else if (resolvedSideB === 'left') pB.x -= margin;
      else if (resolvedSideB === 'bottom') pB.y += margin;
      else if (resolvedSideB === 'top') pB.y -= margin;

      // Common routing variables
      const midX = (pA.x + pB.x) / 2;
      const midY = (pA.y + pB.y) / 2;

      // Bypass bounds (if A or B exist, use their outer edges, else use from/to coordinates)
      const minCardTop = Math.min(rectA ? rectA.top : from.y, rectB ? rectB.top : to.y);
      const maxCardBottom = Math.max(rectA ? rectA.bottom : from.y, rectB ? rectB.bottom : to.y);
      const minCardLeft = Math.min(rectA ? rectA.left : from.x, rectB ? rectB.left : to.x);
      const maxCardRight = Math.max(rectA ? rectA.right : from.x, rectB ? rectB.right : to.x);

      const topY = minCardTop - margin;
      const bottomY = maxCardBottom + margin;
      const leftX = minCardLeft - margin;
      const rightX = maxCardRight + margin;

      // Candidate orthogonal paths
      const rawCandidates = [
        // S-shape via X-midpoint (Z-bend 1)
        [from, pA, { x: midX, y: pA.y }, { x: midX, y: pB.y }, pB, to],
        // S-shape via Y-midpoint (Z-bend 2)
        [from, pA, { x: pA.x, y: midY }, { x: pB.x, y: midY }, pB, to],
        // L-shape 1
        [from, pA, { x: pA.x, y: pB.y }, pB, to],
        // L-shape 2
        [from, pA, { x: pB.x, y: pA.y }, pB, to],
        // C-shape bypass via Top
        [from, pA, { x: pA.x, y: topY }, { x: pB.x, y: topY }, pB, to],
        // C-shape bypass via Bottom
        [from, pA, { x: pA.x, y: bottomY }, { x: pB.x, y: bottomY }, pB, to],
        // C-shape bypass via Left
        [from, pA, { x: leftX, y: pA.y }, { x: leftX, y: pB.y }, pB, to],
        // C-shape bypass via Right
        [from, pA, { x: rightX, y: pA.y }, { x: rightX, y: pB.y }, pB, to]
      ];

      // Evaluate candidates with length and turn penalties
      const safeCandidates = [];
      const allCandidates = [];

      rawCandidates.forEach((rawPath, idx) => {
        const optimized = optimizePoints(rawPath);
        const isSafe = isPathSafe(rawPath, rectA, rectB);
        const actualLength = getPathLength(optimized);

        // Calculate number of turns in the optimized path
        const turns = Math.max(0, optimized.length - 2);

        // 60px penalty per turn to strongly favor simpler layouts and prevent flicker
        const turnPenalty = turns * 60;
        const sortScore = actualLength + turnPenalty;

        const candidateData = {
          path: optimized,
          sortScore,
          isSafe
        };

        allCandidates.push(candidateData);
        if (isSafe) {
          safeCandidates.push(candidateData);
        }
      });

      // Choose path (safe first, falling back to all if none are completely safe, sorted by turn-weighted score)
      const chosenCandidate = (safeCandidates.length > 0 ? safeCandidates : allCandidates)
        .sort((c1, c2) => c1.sortScore - c2.sortScore)[0];

      const chosenPath = chosenCandidate.path;
      const pathStr = pointsToSvgPath(chosenPath, r);
      const midpoint = getPathMidpoint(chosenPath);

      // Collect debug candidates
      const debugCandidates = allCandidates.map((c, idx) => {
        return {
          pathStr: pointsToSvgPath(c.path, r),
          isSafe: c.isSafe,
          id: idx
        };
      });

      return { pathStr, midpoint, debugCandidates };
    }

    const t = 0.5;
    const mt = 1 - t;
    const mt3 = mt * mt * mt;
    const t3 = t * t * t;
    const mt2t = 3 * mt * mt * t;
    const mtt2 = 3 * mt * t * t;

    const midpoint = {
      x: mt3 * from.x + mt2t * cp1.x + mtt2 * cp2.x + t3 * to.x,
      y: mt3 * from.y + mt2t * cp1.y + mtt2 * cp2.y + t3 * to.y
    };

    const pathStr = `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;

    return { pathStr, midpoint, debugCandidates: [] };
  };

  const makeCurvePath = (from, to, sideA, sideB) => {
    return getPathProperties(from, to, sideA, sideB, 'default').pathStr;
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

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
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
    if (pendingPlacementCard) {
      if (e.target.closest('.modal-content') || e.target.closest('.vertical-toolbar-container')) return;
      e.stopPropagation();
      const placedCard = {
        ...pendingPlacementCard,
        x: placementPos.x,
        y: placementPos.y,
      };
      setCards((prev) => [...prev, placedCard]);
      setSelectedCardId(placedCard.id);
      setPendingPlacementCard(null);
      showToast(`${placedCard.title || 'Card'} placed!`, 'success');
      return;
    }

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
      const endpoint = `${API_BASE}/board/${boardId}/verify`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: unlockPassInput }),
      });
      if (!res.ok) throw new Error('Password verification failed');
      const data = await res.json();
      if (data.success) {
        showToast('Editing unlocked.');
        const passToUse = data.hashedPassword || unlockPassInput;
        setDraggBoardPass(boardId, passToUse);
        setLocalPassword(passToUse);
        if (typeof onUpdatePassword === 'function') {
          onUpdatePassword(passToUse);
        }
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
    if (toolMode === 'pen') {
      return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'/%3E%3C/svg%3E") 2 22, auto`;
    }
    if (toolMode === 'eraser') {
      return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23f43f5e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l4.3 4.3c1 1 1 2.5 0 3.4l-9.6 9.6c-1 1-2.5 1-3.4 0z'/%3E%3Cpath d='M19 21H9'/%3E%3C/svg%3E") 6 18, auto`;
    }
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
    if (outlineFilter === 'assigned' && !card.showInSearch) return false;
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = card.title?.toLowerCase().includes(query);
    const contentPlain = card.content ? card.content.replace(/<[^>]*>/g, '').toLowerCase() : '';
    const contentMatch = contentPlain.includes(query);
    return titleMatch || contentMatch;
  });



  return (
    <div className={`board-workspace-wrapper ${isCodePanelOpen ? 'split-screen-active' : ''}`} style={{ display: 'flex', width: '100vw', height: '100dvh', overflow: 'hidden' }}>

      <DraggClipboardSlider
        isOpen={isClipboardSliderOpen}
        onClose={() => setIsClipboardSliderOpen(false)}
        onPasteItem={handlePasteFromDraggClipboard}
        showToast={showToast}
        bgColor={boardBgColor}
      />

      <div
        ref={containerRef}
        className={`canvas-container ${activeToolClass} ${isViewOnly ? 'view-only-canvas' : ''}`}
        onPointerDown={handleContainerMouseDown}
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
        {/* Background Canvas Grid */}
        {gridType !== 'none' && (
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

            {/* Search Scope Filter */}
            <div style={{
              display: 'flex',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <button
                onClick={() => setOutlineFilter('assigned')}
                style={{
                  flex: 1,
                  padding: '0.3rem',
                  border: 'none',
                  borderRadius: '4px',
                  background: outlineFilter === 'assigned' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                  color: outlineFilter === 'assigned' ? 'var(--accent-cyan)' : 'var(--color-text-muted)',
                  fontSize: '0.7rem',
                  fontWeight: outlineFilter === 'assigned' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem'
                }}
              >
                <Check size={11} /> Assigned ({cards.filter(c => c.showInSearch).length})
              </button>
              <button
                onClick={() => setOutlineFilter('all')}
                style={{
                  flex: 1,
                  padding: '0.3rem',
                  border: 'none',
                  borderRadius: '4px',
                  background: outlineFilter === 'all' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  color: outlineFilter === 'all' ? '#fff' : 'var(--color-text-muted)',
                  fontSize: '0.7rem',
                  fontWeight: outlineFilter === 'all' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.25rem'
                }}
              >
                <List size={11} /> All Cards ({cards.length})
              </button>
            </div>

            {/* Topics List */}
            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.3rem', paddingRight: '0.1rem' }}>
              {filteredCards.length === 0 ? (
                <div style={{ padding: '1.2rem 0.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                  {outlineFilter === 'assigned' && cards.filter(c => c.showInSearch).length === 0 ? (
                    <div>
                      <p style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text-main)', fontWeight: 550 }}>No cards assigned to outline.</p>
                      <p style={{ margin: 0, fontSize: '0.68rem', opacity: 0.8, lineHeight: 1.4 }}>Check the box in any card's header to assign it to this outline.</p>
                    </div>
                  ) : cards.length === 0 ? (
                    'No topics created on canvas yet.'
                  ) : (
                    'No matching topics found.'
                  )}
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
          className={`glass canvas-header ${shouldGlowAlert ? 'alert-glow' : ''}`}
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
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
          }}
        >
          {onBack && (
            <button
              type="button"
              className="board-card-delete-btn glass"
              style={{
                padding: '0.35rem 0.55rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(18, 18, 24, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                cursor: 'pointer'
              }}
              onClick={onBack}
              title="Back to Dashboard"
            >
              <ArrowLeft size={14} color="#f8fafc" />
            </button>
          )}

          <button
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
            onClick={() => {
              const shareUrl = `${window.location.origin}/#/board/${boardId}`;
              navigator.clipboard.writeText(shareUrl);
              showToast('Board sharing link copied to clipboard!', 'success');
            }}
            title="Copy Shareable Link"
          >
            <Copy size={12} />
            <span className="header-btn-text" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Share</span>
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
            onClick={handleExportJSON}
            title="Download Board JSON Data (Excludes name & password)"
          >
            <Download size={12} color="var(--accent-cyan)" />
            <span className="header-btn-text" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Export JSON</span>
          </button>

          {(highlightedPathCardDepths || highlightedPathStartCardId) && (
            <button
              className="board-card-delete-btn glass"
              style={{
                padding: '0.35rem 0.55rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                color: '#fca5a5'
              }}
              onClick={handleClearHighlight}
              title="Clear active flow highlight"
            >
              <EyeOff size={13} />
              <span className="header-btn-text" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Clear Highlight</span>
            </button>
          )}

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
            className={`board-card-delete-btn glass ${isClipboardSliderOpen ? 'active' : ''}`}
            style={{
              padding: '0.35rem 0.55rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: isClipboardSliderOpen ? 'rgba(56, 189, 248, 0.2)' : 'rgba(18, 18, 24, 0.4)',
              border: isClipboardSliderOpen ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.05)',
              color: isClipboardSliderOpen ? '#38bdf8' : 'var(--color-text-main)'
            }}
            onClick={() => setIsClipboardSliderOpen(!isClipboardSliderOpen)}
            title="Toggle Dragg Clipboard Slider"
          >
            <Clipboard size={13} color="#38bdf8" />
            <span className="header-btn-text" style={{ fontSize: '0.72rem', fontWeight: 600 }}>Dragg Clipboard</span>
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

          {/* Save Status & Manual Save Button (Placed at the end) */}
          {!isViewOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} title={getSaveStatusLabel()}>
                <div className={`save-dot ${getSaveDotClass()}`} />
                <span
                  style={{
                    color: shouldGlowAlert ? 'var(--accent-rose)' : 'var(--color-text-muted)',
                    fontSize: '0.72rem',
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
        </div>



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

            {/* SVG GRADIENTS AND MARKERS DEFINITIONS */}
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
                const from = (conn.fromOffsetX !== undefined && conn.fromOffsetY !== undefined)
                  ? { x: cardA.x + conn.fromOffsetX, y: cardA.y + conn.fromOffsetY }
                  : getPortCoords(cardA, fromSide);
                const to = (conn.toOffsetX !== undefined && conn.toOffsetY !== undefined)
                  ? { x: cardB.x + conn.toOffsetX, y: cardB.y + conn.toOffsetY }
                  : getPortCoords(cardB, toSide);

                const markerColor = conn.color && conn.color !== 'auto' ? conn.color : colorB;

                return (
                  <React.Fragment key={`defs-${conn.id}`}>
                    <linearGradient
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

                    <marker
                      id={`arrow-${conn.id}`}
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={markerColor} />
                    </marker>
                  </React.Fragment>
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

              const from = (conn.fromOffsetX !== undefined && conn.fromOffsetY !== undefined)
                ? { x: cardA.x + conn.fromOffsetX, y: cardA.y + conn.fromOffsetY }
                : getPortCoords(cardA, fromSide);
              const to = (conn.toOffsetX !== undefined && conn.toOffsetY !== undefined)
                ? { x: cardB.x + conn.toOffsetX, y: cardB.y + conn.toOffsetY }
                : getPortCoords(cardB, toSide);

              const logicalSideA = fromSide === 'freestyle' ? getLogicalSide(cardA, from) : fromSide;
              const logicalSideB = toSide === 'freestyle' ? getLogicalSide(cardB, to) : toSide;

              const connStyle = conn.style || 'default';
              const connAnim = conn.animation || 'none';
              const connThickness = conn.thickness !== undefined ? conn.thickness : 2.5;

              const pathProps = getPathProperties(from, to, logicalSideA, logicalSideB, connStyle, cardA, cardB, conn.waypoints);

              const isConnDimmed = highlightedPathConnectionIds && !highlightedPathConnectionIds.includes(conn.id);
              const sourceDepth = highlightedPathCardDepths
                ? (highlightedPathCardDepths[conn.fromCardId] !== undefined ? highlightedPathCardDepths[conn.fromCardId] : highlightedPathCardDepths[conn.toCardId])
                : undefined;
              const connDelay = sourceDepth !== undefined ? (sourceDepth * 600 + 300) : 0;

              let pathClass1 = 'connection-line';
              let pathClass2 = 'connection-line';

              if (connStyle === 'dotted') {
                if (connAnim === 'flow-forward' || connAnim === 'flow-backward') {
                  pathClass1 += ' conn-anim-dotted-flow';
                } else {
                  pathClass1 += ' conn-style-dotted';
                }
              } else if (connStyle === 'dashed') {
                pathClass1 += ' conn-style-dashed';
                if (connAnim === 'flow-forward') pathClass1 += ' conn-anim-flow-forward';
                else if (connAnim === 'flow-backward') pathClass1 += ' conn-anim-flow-backward';
              } else {
                if (connAnim === 'flow-forward') pathClass1 += ' conn-anim-flow-forward';
                else if (connAnim === 'flow-backward') pathClass1 += ' conn-anim-flow-backward';
              }

              const strokeColor = conn.color && conn.color !== 'auto' ? conn.color : `url(#grad-${conn.id})`;



              return (
                <g
                  key={conn.id}
                  className={`connection-group ${isConnDimmed ? 'is-dimmed' : ''} ${editingConnId === conn.id ? 'is-editing' : ''}`}
                  onMouseEnter={() => {
                    if (!isConnDimmed) setHoveredConnId(conn.id);
                  }}
                  onMouseLeave={() => setHoveredConnId(null)}
                  style={{
                    opacity: isConnDimmed ? 0.08 : 1,
                    transitionProperty: 'opacity',
                    transitionDuration: '0.8s',
                    transitionTimingFunction: 'ease',
                    transitionDelay: !isConnDimmed && sourceDepth !== undefined ? `${connDelay}ms` : '0ms',
                    pointerEvents: isConnDimmed ? 'none' : 'auto'
                  }}
                >
                  {debugRouting && debugCandidates && debugCandidates.map((cand) => (
                    <path
                      key={`debug-${conn.id}-${cand.id}`}
                      d={cand.pathStr}
                      fill="none"
                      stroke={cand.isSafe ? '#22c55e' : '#ef4444'}
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      opacity="0.6"
                      style={{ pointerEvents: 'none' }}
                    />
                  ))}

                  {/* Base Connection Path */}
                  <path
                    d={pathProps.pathStr}
                    fill="none"
                    strokeWidth={connThickness}
                    className={pathClass1}
                    stroke={strokeColor}
                    style={{
                      strokeWidth: `${connThickness}px`,
                      cursor: isConnDimmed ? 'default' : 'pointer',
                      pointerEvents: isConnDimmed ? 'none' : 'auto',
                      filter: 'drop-shadow(0 0 4px rgba(99, 102, 241, 0.25))',
                    }}
                    markerEnd={(connStyle === 'arrow' || connStyle === 'smooth-90' || conn.waypoints?.length > 0) ? `url(#arrow-${conn.id})` : undefined}
                  />

                  {/* Smooth Hover Color Overlay Path */}
                  <path
                    d={pathProps.pathStr}
                    fill="none"
                    strokeWidth={connThickness}
                    className={`${pathClass1} conn-line-hover-overlay`}
                    stroke="#38bdf8"
                    style={{
                      strokeWidth: `${connThickness}px`,
                      cursor: isConnDimmed ? 'default' : 'pointer',
                      pointerEvents: 'none',
                      opacity: (!isConnDimmed && hoveredConnId === conn.id) ? 1 : 0,
                      transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                      filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.6))'
                    }}
                    markerEnd={(connStyle === 'arrow' || connStyle === 'smooth-90' || conn.waypoints?.length > 0) ? `url(#arrow-${conn.id})` : undefined}
                  />

                  {/* Hit Area Path for mouse events */}
                  <path
                    d={pathProps.pathStr}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="20"
                    style={{ cursor: isConnDimmed ? 'default' : 'pointer', pointerEvents: isConnDimmed ? 'none' : 'auto' }}
                  />

                  {/* Connection line path */}
                </g>
              );
            })}

            {/* Render Active Connection Draft Line */}
            {draftConnection && (() => {
              const dragTargetCard = cards.find((c) => {
                if (c.id === draftConnection.fromCardId || c.type === 'group') return false;
                const w = c.width || 250;
                const h = c.height || 200;
                return (
                  draftConnection.current.x >= c.x - 20 &&
                  draftConnection.current.x <= c.x + w + 20 &&
                  draftConnection.current.y >= c.y - 20 &&
                  draftConnection.current.y <= c.y + h + 20
                );
              });

              let draftEnd = draftConnection.current;
              let targetSide = 'center';

              if (dragTargetCard) {
                const isTargetFreestyle = dragTargetCard.nodeLayout === 'freestyle';
                targetSide = isTargetFreestyle ? 'freestyle' : getClosestSide(dragTargetCard, draftConnection.current);
                if (isTargetFreestyle) {
                  const rectB = {
                    left: dragTargetCard.x,
                    top: dragTargetCard.y,
                    right: dragTargetCard.x + (dragTargetCard.width || 250),
                    bottom: dragTargetCard.y + (dragTargetCard.height || 200)
                  };
                  draftEnd = getClosestPointOnRectBorder(draftConnection.current, rectB);
                } else {
                  draftEnd = getPortCoords(dragTargetCard, targetSide);
                }
              }

              const draftPathProps = getPathProperties(
                draftConnection.start,
                draftEnd,
                draftConnection.fromSide,
                targetSide,
                activeConnectorStyle,
                cards.find((c) => c.id === draftConnection.fromCardId),
                dragTargetCard,
                draftConnection.waypoints
              );

              return (
                <React.Fragment>
                  {debugRouting && draftPathProps.debugCandidates && draftPathProps.debugCandidates.map((cand) => (
                    <path
                      key={`debug-draft-${cand.id}`}
                      d={cand.pathStr}
                      fill="none"
                      stroke={cand.isSafe ? '#22c55e' : '#ef4444'}
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                      opacity="0.6"
                      style={{ pointerEvents: 'none' }}
                    />
                  ))}
                  <path
                    d={draftPathProps.pathStr}
                    className="connection-draft"
                    strokeWidth={activeConnectorThickness}
                    style={activeConnectorColor !== 'auto' ? { stroke: activeConnectorColor } : {}}
                  />
                  {/* Waypoint handle dots for draft connection */}
                  {draftConnection.waypoints && draftConnection.waypoints.map((wp, wpIdx) => (
                    <g key={`draft-wp-${wpIdx}`}>
                      <circle
                        cx={wp.x}
                        cy={wp.y}
                        r="4"
                        fill="#0f172a"
                        stroke="#38bdf8"
                        strokeWidth="1.5"
                        style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
                      />
                      <circle
                        cx={wp.x}
                        cy={wp.y}
                        r="1.5"
                        fill="#ffffff"
                      />
                    </g>
                  ))}
                  {dragTargetCard && (
                    <g className="snap-indicator">
                      <circle
                        cx={draftEnd.x}
                        cy={draftEnd.y}
                        r="11"
                        fill="none"
                        stroke="var(--accent-cyan)"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        style={{ filter: 'drop-shadow(0 0 5px rgba(6, 182, 212, 0.6))' }}
                      />
                      <circle
                        cx={draftEnd.x}
                        cy={draftEnd.y}
                        r="4.5"
                        fill="var(--accent-cyan)"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(6, 182, 212, 0.8))' }}
                      />
                    </g>
                  )}
                </React.Fragment>
              );
            })()}
          </svg>

          {/* DOM Cards rendering Layer */}
          <div className="canvas-elements-layer">
            {/* Render Group Containers first (background layer) */}
            {cards.filter((c) => c.type === 'group').map((group) => {
              const childCards = cards.filter(c => c.groupId === group.id);
              const childDepths = childCards.map(c => highlightedPathCardDepths?.[c.id]).filter(d => d !== undefined);
              const isGroupDimmed = highlightedPathCardDepths && childDepths.length === 0;
              const groupDelay = childDepths.length > 0 ? Math.min(...childDepths) * 600 : 0;

              return (
                <GroupContainer
                  key={group.id}
                  group={group}
                  isSelected={selectedCardIds.includes(group.id)}
                  onSelect={handleSelectCard}
                  onUpdate={handleUpdateCard}
                  zoom={zoom}
                  isViewOnly={isViewOnly}
                  isDimmed={isGroupDimmed}
                  highlightDelay={groupDelay}
                />
              );
            })}

            {/* Render standard cards (foreground layer) */}
            {cards.filter((c) => c.type !== 'group').map((card) => {
              const cardDepth = highlightedPathCardDepths?.[card.id];
              const isCardDimmed = highlightedPathCardDepths && cardDepth === undefined;
              const cardDelay = cardDepth !== undefined ? cardDepth * 600 : 0;

              const parentGroup = card.groupId ? cards.find(c => c.id === card.groupId) : null;
              const isParentGroupLocked = parentGroup ? parentGroup.isLocked : false;

              return (
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
                  isDimmed={isCardDimmed}
                  highlightDelay={cardDelay}
                  isParentGroupLocked={isParentGroupLocked}
                  showTextFormatBar={showTextFormatBar}
                  showBadgePicker={activeBadgePickerCardId === card.id}
                  onCloseBadgePicker={() => setActiveBadgePickerCardId(null)}
                  onToggleBadgePicker={(cardId) => setActiveBadgePickerCardId((prev) => (prev === cardId ? null : cardId))}
                  onInspectSystemNode={(node) => setInspectingSystemNode(node)}
                  onOpenCodeStorage={(cardItem) => setActiveCodeStorageCard(cardItem)}
                />
              );
            })}

            {/* Ghost Card Placement Preview attached to Cursor */}
            {pendingPlacementCard && (
              <div
                className="ghost-card-placement-preview"
                style={{
                  position: 'absolute',
                  left: placementPos.x,
                  top: placementPos.y,
                  pointerEvents: 'none',
                  zIndex: 99999,
                  opacity: 0.75,
                  filter: 'drop-shadow(0 12px 32px rgba(0, 0, 0, 0.5))',
                  transform: 'scale(1.01)'
                }}
              >
                <Card
                  card={{
                    ...pendingPlacementCard,
                    x: 0,
                    y: 0
                  }}
                  isSelected={false}
                  onSelect={() => {}}
                  onUpdate={() => {}}
                  onDelete={() => {}}
                  zoom={zoom}
                  onStartConnection={() => {}}
                  toolMode="select"
                  isViewOnly={true}
                />
              </div>
            )}
          </div>

          {/* HTML Connection Pills Overlay Layer (Guaranteed ALWAYS ON TOP of Cards) */}
          <div
            className="connection-pills-overlay-layer"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              overflow: 'visible',
              zIndex: 9999,
              pointerEvents: 'none'
            }}
          >
            {connections.map((conn) => {
              const cardA = cards.find((c) => c.id === conn.fromCardId);
              const cardB = cards.find((c) => c.id === conn.toCardId);
              if (!cardA || !cardB) return null;

              const fromSide = conn.fromSide || 'right';
              const toSide = conn.toSide || 'left';
              const from = (conn.fromOffsetX !== undefined && conn.fromOffsetY !== undefined)
                ? { x: cardA.x + conn.fromOffsetX, y: cardA.y + conn.fromOffsetY }
                : getPortCoords(cardA, fromSide);
              const to = (conn.toOffsetX !== undefined && conn.toOffsetY !== undefined)
                ? { x: cardB.x + conn.toOffsetX, y: cardB.y + conn.toOffsetY }
                : getPortCoords(cardB, toSide);

              const logicalSideA = fromSide === 'freestyle' ? getLogicalSide(cardA, from) : fromSide;
              const logicalSideB = toSide === 'freestyle' ? getLogicalSide(cardB, to) : toSide;
              const connStyle = conn.style || 'default';

              const pathProps = getPathProperties(from, to, logicalSideA, logicalSideB, connStyle, cardA, cardB, conn.waypoints);
              const isConnDimmed = highlightedPathConnectionIds && !highlightedPathConnectionIds.includes(conn.id);

              if (isConnDimmed) return null;

              const isHovered = hoveredConnId === conn.id;
              const isEditing = editingConnId === conn.id;

              return (
                <div
                  key={`pill-overlay-${conn.id}`}
                  className={`conn-pill-wrapper ${isHovered ? 'is-hovered' : ''} ${isEditing ? 'is-editing' : ''}`}
                  onMouseEnter={() => {
                    if (!isConnDimmed) setHoveredConnId(conn.id);
                  }}
                  onMouseLeave={() => setHoveredConnId(null)}
                  style={{
                    position: 'absolute',
                    left: `${pathProps.midpoint.x}px`,
                    top: `${pathProps.midpoint.y}px`,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isEditing ? 999999 : 9999,
                    pointerEvents: 'auto'
                  }}
                >
                  <div className={`conn-node-pill-group ${isHovered ? 'hovered' : ''} ${isEditing ? 'editing' : ''}`}>
                    <div
                      className={`conn-label-pill glass ${isEditing ? 'editing' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editingConnId !== conn.id) {
                          setEditingConnId(conn.id);
                        }
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title={isEditing ? undefined : "Click to edit Label / ID inline"}
                      style={{ pointerEvents: (isHovered || isEditing) ? 'auto' : 'none' }}
                    >
                      <AlignLeft size={11} className="pill-icon" color="#a5b4fc" style={{ flexShrink: 0 }} />
                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          defaultValue={conn.customId || ''}
                          placeholder="Label"
                          className="conn-pill-input"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = String(e.target.value || '').trim();
                              handleUpdateConnectionId(conn.id, val);
                              setEditingConnId(null);
                            } else if (e.key === 'Escape') {
                              setEditingConnId(null);
                            }
                          }}
                          onBlur={(e) => {
                            const val = String(e.target.value || '').trim();
                            handleUpdateConnectionId(conn.id, val);
                            setEditingConnId(null);
                          }}
                        />
                      ) : (
                        <span className="pill-text">{conn.customId ? conn.customId : 'Label'}</span>
                      )}
                    </div>

                    <button
                      type="button"
                      className="conn-circle-btn delete glass"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConnection(conn.id);
                      }}
                      title="Delete Connection"
                      style={{ pointerEvents: (isHovered || isEditing) ? 'auto' : 'none' }}
                    >
                      <Trash2 size={10} />
                    </button>

                    <button
                      type="button"
                      className="conn-circle-btn highlight glass"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleHighlightByCustomId(conn.customId);
                      }}
                      title="Highlight nodes with same ID"
                      style={{ pointerEvents: (isHovered || isEditing) ? 'auto' : 'none' }}
                    >
                      <Sparkles size={10} color="#38bdf8" />
                    </button>
                  </div>
                </div>
              );
            })}
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
          <LeftVerticalToolbar
            onOpenSystemCatalog={boardPreset === 'system_design' ? () => setIsSystemCatalogOpen(true) : undefined}
            onAddCardDirect={handleAddCardDirect}
            onAddCardCustom={handleAddCard}
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
            onResetZoom={handleResetZoom}
            toolMode={toolMode}
            onChangeToolMode={setToolMode}
            onExportPNG={handleExportPNG}
            penColor={penColor}
            onChangePenColor={setPenColor}
            penThickness={penThickness}
            onChangePenThickness={setPenThickness}
            isViewOnly={isViewOnly}
            connectorStyle={activeConnectorStyle}
            onChangeConnectorStyle={handleConnectorStyleChange}
            connectorColor={activeConnectorColor}
            onChangeConnectorColor={handleConnectorColorChange}
            connectorAnimation={activeConnectorAnimation}
            onChangeConnectorAnimation={handleConnectorAnimationChange}
            connectorThickness={activeConnectorThickness}
            onChangeConnectorThickness={handleConnectorThicknessChange}
            toolbarSettings={toolbarSettings}
            onChangeToolbarSettings={setToolbarSettings}
            stylePresets={stylePresets}
            onChangeStylePresets={setStylePresets}
          />
        )}

        {/* Floating Zoom Widget */}
        <div className="zoom-floating-widget">

          <span
            className="zoom-widget-indicator"
            onClick={handleResetZoom}
            title="Recenter/Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="zoom-widget-btn"
            onClick={handleZoomIn}
            title="Zoom In"
          >
            <ZoomIn size={13} />
          </button>
          <button
            className="zoom-widget-btn"
            onClick={handleResetZoom}
            title="Recenter Canvas"
            style={{ marginLeft: '2px', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '6px' }}
          >
            <Maximize size={12} />
          </button>
          <button
            className="zoom-widget-btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            style={{ marginLeft: '2px', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', paddingLeft: '6px' }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>

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

                <div style={{ marginTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.8rem' }}>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Node Connection Layout
                  </span>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>
                      <input
                        type="radio"
                        name="cardNodeLayout"
                        value="four-node"
                        checked={cardNodeLayout === 'four-node'}
                        onChange={() => setCardNodeLayout('four-node')}
                        style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: 'var(--accent-cyan)' }}
                      />
                      <span>Original 4-Node</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>
                      <input
                        type="radio"
                        name="cardNodeLayout"
                        value="freestyle"
                        checked={cardNodeLayout === 'freestyle'}
                        onChange={() => setCardNodeLayout('freestyle')}
                        style={{ cursor: 'pointer', width: '13px', height: '13px', accentColor: 'var(--accent-cyan)' }}
                      />
                      <span>Freestyle</span>
                    </label>
                  </div>
                </div>
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

      {/* Custom Right-Click Context Menu Bar */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
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
                  handleCopyToDraggClipboard();
                  setContextMenu(null);
                }}
              >
                <Clipboard size={13} color="#38bdf8" />
                <span>Copy to Dragg Clipboard</span>
              </button>

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
                <>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      handleGroupSelectedCards();
                      setContextMenu(null);
                    }}
                  >
                    <Box size={13} color="var(--accent-cyan)" />
                    <span>Group Selected Cards</span>
                  </button>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      setCards(prev => prev.map(c => selectedCardIds.includes(c.id) ? { ...c, isLocked: true } : c));
                      setSelectedCardIds([]);
                      setContextMenu(null);
                      showToast(`Locked ${selectedCardIds.length} cards.`);
                    }}
                  >
                    <Lock size={13} color="var(--accent-rose)" />
                    <span>Lock Selected Cards</span>
                  </button>
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      setCards(prev => prev.map(c => selectedCardIds.includes(c.id) ? { ...c, isLocked: false } : c));
                      setSelectedCardIds([]);
                      setContextMenu(null);
                      showToast(`Unlocked ${selectedCardIds.length} cards.`);
                    }}
                  >
                    <Unlock size={13} color="var(--color-text-muted)" />
                    <span>Unlock Selected Cards</span>
                  </button>

                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />
                  <button
                    className={`context-menu-item danger ${deleteConfirmTarget === 'multi_selection' ? 'confirm-active' : ''}`}
                    onClick={() => {
                      if (deleteConfirmTarget === 'multi_selection') {
                        handleDeleteCard(selectedCardIds[0]);
                        setDeleteConfirmTarget(null);
                        setContextMenu(null);
                      } else {
                        setDeleteConfirmTarget('multi_selection');
                      }
                    }}
                    style={deleteConfirmTarget === 'multi_selection' ? {
                      background: 'rgba(239, 68, 68, 0.35)',
                      borderColor: '#ef4444',
                      color: '#ffffff',
                      fontWeight: 700,
                      boxShadow: '0 0 14px rgba(239, 68, 68, 0.4)'
                    } : {}}
                  >
                    {deleteConfirmTarget === 'multi_selection' ? (
                      <>
                        <AlertTriangle size={13} color="#ffffff" />
                        <span>Are you sure?</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={13} color="var(--accent-rose)" />
                        <span>Delete All Selected ({selectedCardIds.length})</span>
                        <span className="context-shortcut">Del</span>
                      </>
                    )}
                  </button>
                </>
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
                  handleCopyToDraggClipboard(contextMenu.cardId);
                  setContextMenu(null);
                }}
              >
                <Clipboard size={13} color="#38bdf8" />
                <span>Copy to Dragg Clipboard</span>
              </button>

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

              {(() => {
                const card = cards.find((c) => c.id === contextMenu.cardId);
                if (card && card.type !== 'group') {
                  return (
                    <button
                      className="context-menu-item"
                      onClick={() => {
                        handleViewPath(contextMenu.cardId);
                        setContextMenu(null);
                      }}
                    >
                      <Compass size={13} color="var(--accent-cyan)" />
                      <span>View Connection Path</span>
                    </button>
                  );
                }
                return null;
              })()}

              {(() => {
                const card = cards.find(c => c.id === contextMenu.cardId);
                if (!card) return null;

                if (card.type === 'group') {
                  return (
                    <>
                      <button
                        className="context-menu-item"
                        onClick={() => {
                          handleUpdateCard(card.id, { dissolveGroup: true });
                          setContextMenu(null);
                        }}
                      >
                        <X size={13} color="var(--accent-rose)" />
                        <span>Ungroup / Dissolve Group</span>
                      </button>
                      {!isViewOnly && (
                        <button
                          className="context-menu-item"
                          onClick={() => {
                            handleUpdateCard(card.id, { isLocked: !card.isLocked });
                            setContextMenu(null);
                          }}
                        >
                          {card.isLocked ? (
                            <>
                              <Unlock size={13} color="var(--color-text-muted)" />
                              <span>Unlock Group Container</span>
                            </>
                          ) : (
                            <>
                              <Lock size={13} color="var(--accent-rose)" />
                              <span>Lock Group Container</span>
                            </>
                          )}
                        </button>
                      )}
                    </>
                  );
                }

                const isHeading = card.title === 'Heading' || card.title === 'Minimal Card' || (!card.features?.notes && !card.features?.sketch && !card.features?.attachments && !card.features?.tags);
                return (
                  <>
                    {!isViewOnly && (
                      <button
                        className="context-menu-item"
                        onClick={() => {
                          setActiveBadgePickerCardId(card.id);
                          setContextMenu(null);
                        }}
                      >
                        <Tag size={13} color="var(--accent-cyan)" />
                        <span>Edit Badge & Tag</span>
                      </button>
                    )}
                    {!isViewOnly && (
                      <button
                        className="context-menu-item"
                        onClick={() => {
                          handleUpdateCard(card.id, { isLocked: !card.isLocked });
                          setContextMenu(null);
                        }}
                      >
                        {card.isLocked ? (
                          <>
                            <Unlock size={13} color="var(--color-text-muted)" />
                            <span>Unlock Card</span>
                          </>
                        ) : (
                          <>
                            <Lock size={13} color="var(--accent-rose)" />
                            <span>Lock Card</span>
                          </>
                        )}
                      </button>
                    )}
                    {card.groupId && !isViewOnly && (
                      <button
                        className="context-menu-item"
                        onClick={() => {
                          handleUpdateCard(card.id, { groupId: '' });
                          setContextMenu(null);
                        }}
                      >
                        <X size={13} color="var(--color-text-muted)" />
                        <span>Remove from Group</span>
                      </button>
                    )}

                    {!isViewOnly && (
                      <>
                        <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent-cyan)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Styling & Layout
                        </span>

                        {/* Assign to Outline Sidebar */}
                        <button
                          className="context-menu-item"
                          onClick={() => {
                            handleUpdateCard(card.id, { showInSearch: !card.showInSearch });
                            setContextMenu(null);
                          }}
                        >
                          <Check size={13} color={card.showInSearch ? 'var(--accent-cyan)' : 'var(--color-text-muted)'} />
                          <span>{card.showInSearch ? 'Remove from Outline' : 'Show in Outline Sidebar'}</span>
                        </button>

                        {/* Connection Layout Snapping style */}
                        <button
                          className="context-menu-item"
                          onClick={() => {
                            handleUpdateCard(card.id, { nodeLayout: card.nodeLayout === 'freestyle' ? 'four-node' : 'freestyle' });
                            setContextMenu(null);
                          }}
                        >
                          <Link2 size={13} color="var(--accent-cyan)" style={{ marginRight: '6px' }} />
                          <span>{card.nodeLayout === 'freestyle' ? 'Switch to 4-Port Snapping' : 'Switch to Freestyle Snapping'}</span>
                        </button>

                        {/* Complete status (only for standard cards) */}
                        {!isHeading && (
                          <button
                            className="context-menu-item"
                            onClick={() => {
                              handleUpdateCard(card.id, { completed: !card.completed });
                              setContextMenu(null);
                            }}
                          >
                            <Check size={13} color={card.completed ? 'var(--accent-emerald)' : 'var(--color-text-muted)'} />
                            <span>{card.completed ? 'Mark as Incomplete' : 'Mark as Completed'}</span>
                          </button>
                        )}

                        {/* Card Background Color Selector */}
                        <div style={{ padding: '6px 8px 4px 8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Card Color Theme</span>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {['slate', 'indigo', 'cyan', 'emerald', 'amber', 'rose'].map((col) => {
                              const accentColors = {
                                slate: '#64748b',
                                indigo: '#6366f1',
                                cyan: '#06b6d4',
                                emerald: '#10b981',
                                amber: '#f59e0b',
                                rose: '#f43f5e',
                              };
                              return (
                                <div
                                  key={col}
                                  onClick={() => {
                                    handleUpdateCard(card.id, { color: col });
                                    setContextMenu(null);
                                  }}
                                  style={{
                                    width: '16px',
                                    height: '16px',
                                    borderRadius: '50%',
                                    backgroundColor: accentColors[col],
                                    border: card.color === col ? '1.5px solid white' : '1px solid rgba(255,255,255,0.2)',
                                    cursor: 'pointer',
                                    boxShadow: card.color === col ? `0 0 6px ${accentColors[col]}` : 'none',
                                    transition: 'transform 0.1s'
                                  }}
                                  title={col}
                                />
                              );
                            })}

                            {/* Pick Custom Color Input */}
                            <label
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{
                                width: '17px',
                                height: '17px',
                                borderRadius: '50%',
                                background: 'conic-gradient(#f43f5e, #f59e0b, #10b981, #06b6d4, #6366f1, #d946ef, #f43f5e)',
                                border: card.color?.startsWith('#') ? '1.5px solid white' : '1px solid rgba(255,255,255,0.3)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: card.color?.startsWith('#') ? `0 0 6px ${card.color}` : 'none',
                                position: 'relative',
                                transition: 'transform 0.1s'
                              }}
                              title="Pick Custom Color..."
                            >
                              <input
                                type="color"
                                value={card.color?.startsWith('#') ? card.color : '#06b6d4'}
                                onInput={(e) => {
                                  e.stopPropagation();
                                  handleUpdateCard(card.id, { color: e.target.value });
                                }}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleUpdateCard(card.id, { color: e.target.value });
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                              />
                            </label>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}

              {!isViewOnly && (
                <>
                  <div style={{ height: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />
                  <button
                    className="context-menu-item"
                    onClick={() => {
                      handleHighlightAllConnected(contextMenu.cardId);
                      setContextMenu(null);
                    }}
                    style={{ color: '#38bdf8', fontWeight: 600 }}
                  >
                    <Sparkles size={13} color="#38bdf8" />
                    <span>Highlight Connected Nodes & Cards</span>
                  </button>
                  <button
                    className={`context-menu-item danger ${deleteConfirmTarget === contextMenu.cardId ? 'confirm-active' : ''}`}
                    onClick={() => {
                      if (deleteConfirmTarget === contextMenu.cardId) {
                        handleDeleteCard(contextMenu.cardId);
                        setDeleteConfirmTarget(null);
                        setContextMenu(null);
                      } else {
                        setDeleteConfirmTarget(contextMenu.cardId);
                      }
                    }}
                    style={deleteConfirmTarget === contextMenu.cardId ? {
                      background: 'rgba(239, 68, 68, 0.35)',
                      borderColor: '#ef4444',
                      color: '#ffffff',
                      fontWeight: 700,
                      boxShadow: '0 0 14px rgba(239, 68, 68, 0.4)'
                    } : {}}
                  >
                    {deleteConfirmTarget === contextMenu.cardId ? (
                      <>
                        <AlertTriangle size={13} color="#ffffff" />
                        <span>Are you sure?</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={13} color="var(--accent-rose)" />
                        <span>Delete Card</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </>
          ) : null}

          {!contextMenu.cardId && selectedCardIds.length <= 1 && (
            <>
              {(!isViewOnly || highlightedPathCardDepths) && (
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', padding: '4px 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Canvas Actions
                </span>
              )}

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
                    <span>New Minimal Card</span>
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
                </>
              )}

              {highlightedPathCardDepths && (
                <button
                  className="context-menu-item"
                  onClick={() => {
                    handleClearHighlight();
                    setContextMenu(null);
                  }}
                >
                  <X size={13} color="var(--accent-rose)" />
                  <span>Clear Path Highlight</span>
                </button>
              )}

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
            </>
          )}
        </div>
      )}




    </div>
  );
}

export default FreestyleCanvas;
