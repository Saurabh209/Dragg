import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Hand, FileText, Lock, Eye, Settings, Link2, Pencil, Image as ImageIcon, Info, X, Sparkles, MousePointerClick, BoxSelect, Layers, Palette, Compass, Type, Search } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function Dashboard({ onSelectBoard, showToast }) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardPassword, setNewBoardPassword] = useState('');
  const [newBoardProtectionMode, setNewBoardProtectionMode] = useState('none');
  const [newBoardPreset, setNewBoardPreset] = useState('freestyle');
  
  // Board unlock modal states (when clicking fully protected board)
  const [boardToUnlock, setBoardToUnlock] = useState(null);
  const [unlockPassword, setUnlockPassword] = useState('');

  // Custom delete confirmation state
  const [boardToDelete, setBoardToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [showImportHelpModal, setShowImportHelpModal] = useState(false);
  const [showWhatsNewModal, setShowWhatsNewModal] = useState(false);
  const [forceViewOnlyPending, setForceViewOnlyPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [hasSeenWhatsNew, setHasSeenWhatsNew] = useState(() => {
    return localStorage.getItem('dragg_has_seen_whats_new') === 'true';
  });

  const handleCloseWhatsNew = () => {
    localStorage.setItem('dragg_has_seen_whats_new', 'true');
    setHasSeenWhatsNew(true);
    setShowWhatsNewModal(false);
  };

  // Keyboard control settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [keybindings, setKeybindings] = useState(() => {
    const saved = localStorage.getItem('dragg-keybindings');
    return saved ? JSON.parse(saved) : {
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
  const [activeBindingKey, setActiveBindingKey] = useState(null);

  useEffect(() => {
    fetchBoards();
  }, []);

  useEffect(() => {
    if (!activeBindingKey) return;

    const handleGlobalKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setActiveBindingKey(null);
        showToast('Binding cancelled.');
        return;
      }

      const newKeybindings = {
        ...keybindings,
        [activeBindingKey]: {
          ...keybindings[activeBindingKey],
          key: e.key.toLowerCase(),
          code: e.code
        }
      };
      setKeybindings(newKeybindings);
      localStorage.setItem('dragg-keybindings', JSON.stringify(newKeybindings));
      setActiveBindingKey(null);
      showToast(`Bound "${keybindings[activeBindingKey].label}" to "${e.key.toUpperCase()}"`);
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [activeBindingKey, keybindings]);

  const fetchBoards = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/boards`);
      if (!res.ok) throw new Error('Failed to fetch boards');
      const data = await res.json();
      const sorted = Array.isArray(data) ? data.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return timeB - timeA;
      }) : [];
      setBoards(sorted);
    } catch (err) {
      console.error(err);
      showToast('Could not fetch boards. Check if backend is running!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    try {
      const primaryEndpoint = newBoardPreset === 'system_design' 
        ? `${API_BASE}/system-design-boards`
        : `${API_BASE}/freestyle-boards`;

      const payload = { 
        name: newBoardName.trim(),
        password: newBoardPassword,
        protectionMode: newBoardProtectionMode,
        preset: newBoardPreset
      };

      let res;
      try {
        res = await fetch(primaryEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (primaryErr) {
        console.warn('Primary creation endpoint failed, trying fallback /api/boards', primaryErr);
      }

      if (!res || !res.ok) {
        res = await fetch(`${API_BASE}/boards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res || !res.ok) throw new Error('Failed to create board');
      const data = await res.json();
      showToast(`Board "${data.name}" created!`);
      
      const p = data.hashedPassword || newBoardPassword;
      if (p) {
        localStorage.setItem(`dragg-board-pass-${data._id}`, p);
      }
      
      setNewBoardName('');
      setNewBoardPassword('');
      setNewBoardProtectionMode('none');
      setNewBoardPreset('freestyle');
      setIsModalOpen(false);
      
      onSelectBoard(data._id, p || '', false);
    } catch (err) {
      console.error(err);
      showToast('Failed to create board. Check backend server connection on port 5000!', 'error');
    }
  };

  const [isDevUnlocked, setIsDevUnlocked] = useState(() => localStorage.getItem('dragg_force_dev_unlocked') === 'true');
  const [isSimulatedProd, setIsSimulatedProd] = useState(() => localStorage.getItem('dragg_simulated_prod') === 'true');

  useEffect(() => {
    const handleEnvChange = () => {
      setIsDevUnlocked(localStorage.getItem('dragg_force_dev_unlocked') === 'true');
      setIsSimulatedProd(localStorage.getItem('dragg_simulated_prod') === 'true');
    };
    window.addEventListener('dragg-env-change', handleEnvChange);
    return () => window.removeEventListener('dragg-env-change', handleEnvChange);
  }, []);

  const isDevMode = isDevUnlocked || (import.meta.env.DEV && !isSimulatedProd);

  const handleBoardClick = async (board) => {
    if (board.preset === 'system_design' && !isDevMode) {
      showToast("You don't have access to development feature", 'error');
      return;
    }
    const unPrefixedId = board._id.replace(/^(fs_|sd_)/, '');
    const savedHash = localStorage.getItem(`dragg-board-pass-${board._id}`) || localStorage.getItem(`dragg-board-pass-${unPrefixedId}`);

    if (board.protectionMode === 'full') {
      if (savedHash) {
        try {
          const res = await fetch(`${API_BASE}/boards/${board._id}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: savedHash }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              onSelectBoard(board._id, savedHash, false);
              return;
            }
          }
        } catch (err) {
          console.error('Error auto-verifying password:', err);
        }
        localStorage.removeItem(`dragg-board-pass-${board._id}`);
        localStorage.removeItem(`dragg-board-pass-${unPrefixedId}`);
      }
      setBoardToUnlock(board);
      setUnlockPassword('');
    } else {
      // Partial lock - pass saved hash if available
      onSelectBoard(board._id, savedHash || '', false);
    }
  };

  const handleViewOnlyClick = (board) => {
    const unPrefixedId = board._id.replace(/^(fs_|sd_)/, '');
    const savedHash = localStorage.getItem(`dragg-board-pass-${board._id}`) || localStorage.getItem(`dragg-board-pass-${unPrefixedId}`) || '';
    if (board.protectionMode === 'full' && !savedHash) {
      setForceViewOnlyPending(true);
      setBoardToUnlock(board);
      setUnlockPassword('');
    } else {
      onSelectBoard(board._id, savedHash, true);
    }
  };

  const handleVerifyUnlock = async (e) => {
    e.preventDefault();
    if (!boardToUnlock) return;

    try {
      let endpoint = boardToUnlock._id.startsWith('sd_')
        ? `${API_BASE}/system-design-boards/${boardToUnlock._id}/verify`
        : boardToUnlock._id.startsWith('fs_')
        ? `${API_BASE}/freestyle-boards/${boardToUnlock._id}/verify`
        : `${API_BASE}/boards/${boardToUnlock._id}/verify`;

      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: unlockPassword }),
      });
      if (!res.ok) {
        res = await fetch(`${API_BASE}/boards/${boardToUnlock._id}/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: unlockPassword }),
        });
      }
      if (!res.ok) throw new Error('Password verification failed');
      const data = await res.json();
      if (data.success) {
        showToast('Access granted.');
        const boardId = boardToUnlock._id;
        const unPrefixedId = boardId.replace(/^(fs_|sd_)/, '');
        const passToUse = data.hashedPassword || unlockPassword;
        localStorage.setItem(`dragg-board-pass-${boardId}`, passToUse);
        localStorage.setItem(`dragg-board-pass-${unPrefixedId}`, passToUse);
        setBoardToUnlock(null);
        setUnlockPassword('');
        onSelectBoard(boardId, passToUse, forceViewOnlyPending);
        setForceViewOnlyPending(false);
      } else {
        showToast('Incorrect password.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error validating password.', 'error');
    }
  };

  const handleDeleteBoard = async () => {
    if (!boardToDelete) return;
    const { _id, id: boardIdAlt, name, protectionMode, preset } = boardToDelete;
    const id = _id || boardIdAlt;

    try {
      const headers = {};
      if (protectionMode === 'full' || protectionMode === 'partial') {
        headers['x-board-password'] = deletePassword;
      }

      let endpoint = `${API_BASE}/boards/${id}`;
      if (preset === 'system_design') {
        endpoint = `${API_BASE}/system-design-boards/${id}`;
      } else if (preset === 'freestyle') {
        endpoint = `${API_BASE}/freestyle-boards/${id}`;
      }

      let res = await fetch(endpoint, { 
        method: 'DELETE',
        headers
      });

      if (!res.ok && endpoint !== `${API_BASE}/boards/${id}`) {
        res = await fetch(`${API_BASE}/boards/${id}`, {
          method: 'DELETE',
          headers
        });
      }
      
      if (res.status === 401) {
        showToast('Incorrect password. Authorization failed.', 'error');
        return;
      }
      if (!res.ok) throw new Error('Failed to delete board');
      
      showToast(`Board "${name}" deleted.`);
      localStorage.removeItem(`dragg-board-pass-${id}`); // Clean up password hash
      setBoards((prev) => prev.filter((b) => (b._id || b.id) !== id));
      setBoardToDelete(null);
      setDeletePassword('');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete board.', 'error');
    }
  };

  // Structured Notes text file parser (Markdown / Plain Text)
  const parseNotesText = (text, fileName) => {
    const lines = text.split(/\r?\n/);
    const boardName = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    const board = {
      name: boardName,
      preset: 'freestyle',
      cards: [],
      connections: [],
      pan: { x: 200, y: 150 },
      zoom: 0.85
    };

    let currentCard = null;
    let inCodeBlock = false;
    let codeLines = [];
    const colors = ['slate', 'indigo', 'cyan', 'emerald', 'amber', 'rose'];

    const createNewCard = (title) => {
      const cardIndex = board.cards.length;
      return {
        id: 'card_' + Math.random().toString(36).substring(2, 11),
        title: title || 'Untitled Card',
        content: '',
        code: '',
        tags: [],
        color: colors[cardIndex % colors.length],
        type: 'note',
        cardMode: 'notes',
        width: 280,
        height: 200,
        x: cardIndex * 360,
        y: 150,
        badge: null,
        features: { notes: true, sketch: true, attachments: true, tags: true }
      };
    };

    lines.forEach((line) => {
      const trimmed = line.trim();

      // Heading line (# Heading Title) -> Creates new card
      if (trimmed.startsWith('#')) {
        const cardTitle = trimmed.replace(/^#+\s*/, '');
        currentCard = createNewCard(cardTitle);
        board.cards.push(currentCard);
        return;
      }

      if (!currentCard) {
        if (trimmed.length > 0) {
          currentCard = createNewCard('Overview Note');
          board.cards.push(currentCard);
        } else {
          return;
        }
      }

      // Code Block Handling (```js ... ```)
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          currentCard.code = codeLines.join('\n');
          currentCard.cardMode = 'code';
          codeLines = [];
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        return;
      }

      // Tags line: e.g. "Tags: API, Gateway, Microservice"
      if (trimmed.toLowerCase().startsWith('tags:')) {
        const tagList = trimmed.substring(5).split(',').map((t) => t.trim()).filter(Boolean);
        currentCard.tags = [...new Set([...currentCard.tags, ...tagList])];
        return;
      }

      // Badge line: e.g. "Badge: ENTRY POINT"
      if (trimmed.toLowerCase().startsWith('badge:')) {
        const badgeVal = trimmed.substring(6).trim();
        if (badgeVal) {
          currentCard.badge = { text: badgeVal, color: '' };
        }
        return;
      }

      // Type line: e.g. "Type: minimal" or "Type: code"
      if (trimmed.toLowerCase().startsWith('type:')) {
        const typeVal = trimmed.substring(5).trim().toLowerCase();
        if (['minimal', 'note', 'code'].includes(typeVal)) {
          currentCard.type = typeVal;
          if (typeVal === 'minimal') currentCard.cardMode = 'notes';
        }
        return;
      }

      // Color line: e.g. "Color: indigo"
      if (trimmed.toLowerCase().startsWith('color:')) {
        const colorVal = trimmed.substring(6).trim().toLowerCase();
        if (colors.includes(colorVal)) {
          currentCard.color = colorVal;
        }
        return;
      }

      // Content paragraph
      if (currentCard.content) {
        currentCard.content += '\n' + line;
      } else {
        currentCard.content = line;
      }
    });

    // Auto-create connection wires sequentially (Card 1 -> Card 2 -> Card 3)
    if (board.cards.length > 1) {
      for (let i = 0; i < board.cards.length - 1; i++) {
        board.connections.push({
          id: `conn-auto-${i}-${Math.random().toString(36).substring(2, 6)}`,
          fromCardId: board.cards[i].id,
          fromSide: 'right',
          toCardId: board.cards[i + 1].id,
          toSide: 'left',
          label: ''
        });
      }
    }

    return [board];
  };

  const handleImportNotesFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      let parsedBoards = [];

      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            if (json.length > 0 && json[0].name) {
              parsedBoards = json;
            } else {
              parsedBoards = [{
                name: file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
                preset: 'freestyle',
                cards: json.map((c, i) => ({
                  id: c.id || 'card_' + Math.random().toString(36).substring(2, 11),
                  title: c.title || `Card ${i + 1}`,
                  content: c.content || '',
                  code: c.code || '',
                  badge: c.badge || null,
                  tags: c.tags || [],
                  color: c.color || 'slate',
                  x: c.x !== undefined ? c.x : i * 360,
                  y: c.y !== undefined ? c.y : 150,
                  width: c.width || 280,
                  height: c.height || 200,
                  type: c.type || 'note',
                  cardMode: c.cardMode || (c.code ? 'code' : 'notes'),
                  features: { notes: true, sketch: true, attachments: true, tags: true }
                })),
                connections: [],
                pan: { x: 100, y: 100 },
                zoom: 0.85
              }];
            }
          } else if (typeof json === 'object' && json !== null) {
            parsedBoards = [{
              name: json.name || file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
              preset: 'freestyle',
              cards: (json.cards || []).map((c, i) => ({
                id: c.id || 'card_' + Math.random().toString(36).substring(2, 11),
                title: c.title || `Card ${i + 1}`,
                content: c.content || '',
                code: c.code || '',
                badge: c.badge || null,
                tags: c.tags || [],
                color: c.color || 'slate',
                x: c.x !== undefined ? c.x : i * 360,
                y: c.y !== undefined ? c.y : 150,
                width: c.width || 280,
                height: c.height || 200,
                type: c.type || 'note',
                cardMode: c.cardMode || (c.code ? 'code' : 'notes'),
                features: { notes: true, sketch: true, attachments: true, tags: true }
              })),
              connections: json.connections || [],
              pan: json.pan || { x: 100, y: 100 },
              zoom: json.zoom || 0.85
            }];
          }
        } catch (jsonErr) {
          console.error(jsonErr);
          showToast('Invalid JSON file format.', 'error');
          return;
        }
      } else {
        parsedBoards = parseNotesText(text, file.name);
      }

      if (parsedBoards.length === 0) {
        showToast('No valid boards or cards found in text file.', 'error');
        return;
      }

      showToast(`Generating ${parsedBoards.length} board(s)...`);

      try {
        for (const pb of parsedBoards) {
          const payload = {
            name: pb.name,
            preset: 'freestyle',
            cards: pb.cards || [],
            connections: pb.connections || [],
            pan: pb.pan || { x: 200, y: 150 },
            zoom: pb.zoom || 0.85
          };

          let createRes;
          try {
            createRes = await fetch(`${API_BASE}/freestyle-boards`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } catch (err) {
            console.warn('Freestyle import endpoint failed, falling back to /api/boards', err);
          }

          if (!createRes || !createRes.ok) {
            createRes = await fetch(`${API_BASE}/boards`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          }

          if (!createRes || !createRes.ok) throw new Error('Failed to create board during import');
          const data = await createRes.json();

          if (pb.cards && pb.cards.length > 0) {
            await fetch(`${API_BASE}/freestyle-boards/${data._id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cards: pb.cards, connections: pb.connections || [] }),
            }).catch(() => {});
          }
        }

        showToast(`Successfully imported ${parsedBoards.length} board(s)!`);
        fetchBoards(); // Reload list
      } catch (err) {
        console.error(err);
        showToast('Error importing boards from file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input target
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const filteredBoards = boards.filter((board) => {
    const matchesSearch = (board.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilter === 'freestyle') return board.preset === 'freestyle' || !board.preset;
    if (activeFilter === 'system_design') return board.preset === 'system_design';
    if (activeFilter === 'protected') return board.protectionMode === 'full' || board.protectionMode === 'partial';
    return true;
  });

  return (
    <div className="dashboard-container">
      {/* Background Ambient Glowing Orbs */}
      <div className="dashboard-ambient-bg" />

      {/* Top Navigation Header */}
      <header className="dashboard-nav-header">
        <div className="dashboard-brand" onClick={() => {}}>
          <img src="/favicon.svg" alt="Dragg Logo" className="dashboard-logo-img" />
          <div className="dashboard-brand-text">
            <h1 className="dashboard-title">dragg</h1>
            <span className="dashboard-subtitle-tag">FREE-FORM CANVAS</span>
          </div>
        </div>

        <div className="dashboard-top-actions">
          {!hasSeenWhatsNew && (
            <button 
              className="whats-new-btn glass"
              onClick={() => setShowWhatsNewModal(true)}
              title="What's New in Dragg"
            >
              <Sparkles size={15} />
              <span className="whats-new-text">What's New</span>
            </button>
          )}

          <button 
            className="dashboard-settings-btn glass"
            onClick={() => setIsSettingsOpen(true)}
            title="Control Settings"
          >
            <Settings size={15} />
            <span className="dashboard-settings-text">Controls</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="dashboard-content-body">
        {/* Standalone Action Buttons Bar (Outside Navbar) */}
        <div className="dashboard-standalone-actions">
          <button 
            className="btn btn-primary create-board-glow-btn large-action-btn"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} />
            <span>Create New Board</span>
          </button>

          <div className="import-btn-group large-import-group">
            <label 
              className="glass-btn import-notes-glow-btn large-action-btn"
              title="Import boards from structured text or markdown files (.txt, .md, .json)"
            >
              <FileText size={18} color="var(--accent-cyan)" />
              <span>Import Notes</span>
              <span className="beta-chip">BETA</span>
              <input 
                type="file" 
                accept=".txt,.md,.json" 
                onChange={handleImportNotesFile} 
                style={{ display: 'none' }} 
              />
            </label>

            <button
              onClick={() => setShowImportHelpModal(true)}
              className="glass-btn info-help-btn large-info-btn"
              title="View Supported Formats & JSON Template Guide"
            >
              <Info size={18} />
            </button>
          </div>
        </div>

        {/* Board Cards Grid */}
        <div className="dashboard-grid-wrapper">
          {loading ? (
            <div className="dashboard-loading-state">
              <div className="loading-spinner" />
              <span>Fetching whiteboards...</span>
            </div>
          ) : (
            <div className="dashboard-grid">
              {boards.length === 0 ? (
                <div className="dashboard-empty-card">
                  <div className="empty-icon-wrap">
                    <Compass size={32} color="var(--accent-indigo)" />
                  </div>
                  <h3>No whiteboards found</h3>
                  <p>Click "Create New Board" or "Import Notes" above to create your first canvas!</p>
                </div>
              ) : (
                boards.map((board) => {
                  const cardCount = board.cards?.length || 0;
                  const noteCount = board.cards?.filter(c => c.type === 'note' || !c.type).length || 0;
                  const imageCount = board.cards?.filter(c => c.type === 'image').length || 0;
                  const linkCount = board.connections?.length || 0;
                  const strokeCount = board.drawings?.length || 0;
                  const isSystemDesignProd = board.preset === 'system_design' && !isDevMode;

                  return (
                    <div 
                      key={board._id} 
                      className={`board-card modern-glass-card ${board.preset === 'system_design' ? 'system-design-card' : 'freestyle-card'}`}
                      onClick={() => handleBoardClick(board)}
                      title={isSystemDesignProd ? "You don't have access to development feature" : board.name}
                      style={{
                        cursor: isSystemDesignProd ? 'not-allowed' : 'pointer',
                        opacity: isSystemDesignProd ? 0.8 : 1
                      }}
                    >
                      <div className="board-card-header-row">
                        <div className="board-card-title-group">
                          <span className="board-preset-dot" title={board.preset === 'system_design' ? 'System Design' : 'Freestyle'} />
                          <h3 className="board-card-name-text" title={board.name}>
                            {board.name}
                          </h3>
                        </div>

                        <div className="board-card-badges">
                          {board.preset === 'system_design' && (
                            <span className={`preset-pill ${isDevMode ? 'dev' : 'coming'}`}>
                              {isDevMode ? 'DEV MODE' : '🚧 COMING SOON'}
                            </span>
                          )}
                          {board.protectionMode === 'full' && (
                            <span className="protection-pill full" title="Fully Password Protected">
                              <Lock size={11} />
                              <span>Private</span>
                            </span>
                          )}
                          {board.protectionMode === 'partial' && (
                            <span className="protection-pill partial" title="Partially Protected (View Only)">
                              <Eye size={11} />
                              <span>View-Only</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stat Counters Grid */}
                      <div className="board-card-stats-grid">
                        <div className="board-stat-chip notes" title={`${noteCount} Note Cards`}>
                          <FileText size={11} />
                          <span>{noteCount} {noteCount === 1 ? 'Note' : 'Notes'}</span>
                        </div>
                        <div className="board-stat-chip images" title={`${imageCount} Images`}>
                          <ImageIcon size={11} />
                          <span>{imageCount} {imageCount === 1 ? 'Image' : 'Images'}</span>
                        </div>
                        <div className="board-stat-chip links" title={`${linkCount} Connection Links`}>
                          <Link2 size={11} />
                          <span>{linkCount} {linkCount === 1 ? 'Link' : 'Links'}</span>
                        </div>
                        {strokeCount > 0 && (
                          <div className="board-stat-chip sketches" title={`${strokeCount} Sketches`}>
                            <Pencil size={11} />
                            <span>{strokeCount} {strokeCount === 1 ? 'Sketch' : 'Sketches'}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer Info Row */}
                      <div className="board-card-footer-row">
                        <div className="board-card-date">
                          <Calendar size={12} />
                          <span>{formatDate(board.updatedAt || board.createdAt)}</span>
                        </div>

                        <div className="board-card-actions">
                          {(board.protectionMode === 'full' || board.protectionMode === 'partial') && (
                            <button
                              className="card-action-icon view-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewOnlyClick(board);
                              }}
                              title="Open in View Only Mode"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          
                          <button 
                            className="card-action-icon delete-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBoardToDelete(board);
                              setDeletePassword('');
                            }}
                            title="Delete Board"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Board Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsModalOpen(false);
          setNewBoardPassword('');
          setNewBoardProtectionMode('none');
          setNewBoardPreset('freestyle');
        }}>
          <form 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateBoard}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxWidth: '500px', width: '92%' }}
          >
            <h2 className="modal-title">Create New Board</h2>
            
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              Select Preset
              <div className="preset-selection-container">
                <div 
                  type="button"
                  className={`preset-card ${newBoardPreset === 'freestyle' ? 'selected' : ''}`}
                  onClick={() => setNewBoardPreset('freestyle')}
                >
                  <div className="preset-card-icon-container">
                    <Sparkles size={18} />
                  </div>
                  <span className="preset-card-name">Freestyle</span>
                  <span className="preset-card-desc">Open canvas with notes, code sandboxes, sketches, and uploads.</span>
                </div>
                <div 
                  type="button"
                  className={`preset-card ${newBoardPreset === 'system_design' ? 'selected' : ''}`}
                  onClick={() => {
                    if (!isDevMode) {
                      showToast('System Design feature is under active development in Production.', 'info');
                      return;
                    }
                    setNewBoardPreset('system_design');
                  }}
                  style={{ cursor: isDevMode ? 'pointer' : 'not-allowed', opacity: isDevMode ? 1 : 0.65 }}
                >
                  {isDevMode ? (
                    <span className="preset-card-badge" style={{ background: '#10b981', color: '#ffffff' }}>DEV MODE</span>
                  ) : (
                    <span className="preset-card-badge" style={{ background: '#f59e0b', color: '#ffffff' }}>UNDER DEVELOPMENT</span>
                  )}
                  <div className="preset-card-icon-container">
                    <Layers size={18} style={{ color: isDevMode ? '#10b981' : '#f59e0b' }} />
                  </div>
                  <span className="preset-card-name">System Design</span>
                  <span className="preset-card-desc">
                    {isDevMode 
                      ? 'Developer canvas preloaded with frontend, gateways, load balancers, DBs, and 90° links.' 
                      : 'Under Active Development (Available in Dev Mode).'}
                  </span>
                </div>
              </div>
            </div>

            <input 
              type="text" 
              className="modal-input" 
              placeholder="Board name..." 
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              autoFocus
              required
            />
            
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>
              Protection Mode
              <div className="protection-btn-group">
                <button
                  type="button"
                  className={`protection-btn ${newBoardProtectionMode === 'none' ? 'selected' : ''}`}
                  onClick={() => {
                    setNewBoardProtectionMode('none');
                    setNewBoardPassword('');
                  }}
                  title="Public: Open board, anyone can view and edit."
                >
                  Public
                </button>
                <button
                  type="button"
                  className={`protection-btn ${newBoardProtectionMode === 'partial' ? 'selected' : ''}`}
                  onClick={() => setNewBoardProtectionMode('partial')}
                  title="Partial Lock: Anyone can view, but edits/deletions require the password."
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                >
                  Partial Lock
                  <Info size={11} style={{ opacity: 0.6 }} />
                </button>
                <button
                  type="button"
                  className={`protection-btn ${newBoardProtectionMode === 'full' ? 'selected' : ''}`}
                  onClick={() => setNewBoardProtectionMode('full')}
                  title="Full Lock: Password required to enter or view the board."
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                >
                  Full Lock
                  <Info size={11} style={{ opacity: 0.6 }} />
                </button>
              </div>
            </div>

            <div style={{
              maxHeight: newBoardProtectionMode !== 'none' ? '60px' : '0px',
              opacity: newBoardProtectionMode !== 'none' ? 1 : 0,
              overflow: 'hidden',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              marginTop: newBoardProtectionMode !== 'none' ? '0.2rem' : '0px',
              marginBottom: newBoardProtectionMode !== 'none' ? '0.2rem' : '0px'
            }}>
              <input
                type="password"
                className="modal-input"
                placeholder="Set Board Password..."
                value={newBoardPassword}
                onChange={(e) => setNewBoardPassword(e.target.value)}
                required={newBoardProtectionMode !== 'none'}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '0.6rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setIsModalOpen(false);
                  setNewBoardPassword('');
                  setNewBoardProtectionMode('none');
                  setNewBoardPreset('freestyle');
                }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Unlock Board Modal */}
      {boardToUnlock && (
        <div className="modal-overlay" onClick={() => {
          setBoardToUnlock(null);
          setUnlockPassword('');
        }}>
          <form 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleVerifyUnlock}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
          >
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={20} color="var(--accent-rose)" /> Unlock Board
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: '1.4' }}>
              <strong>"{boardToUnlock.name}"</strong> is fully password protected. Please enter the password to open this board.
            </p>
            <input 
              type="password" 
              className="modal-input" 
              placeholder="Enter password..." 
              value={unlockPassword}
              onChange={(e) => setUnlockPassword(e.target.value)}
              autoFocus
              required
            />
            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setBoardToUnlock(null);
                  setUnlockPassword('');
                }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ background: 'var(--accent-indigo)' }}
              >
                Unlock
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Custom Delete Board Confirmation Modal */}
      {boardToDelete && (
        <div className="modal-overlay" onClick={() => {
          setBoardToDelete(null);
          setDeletePassword('');
        }}>
          <form 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleDeleteBoard}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
          >
            <h2 className="modal-title" style={{ color: 'var(--accent-rose)' }}>Delete Board?</h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: '1.4' }}>
              Are you sure you want to delete board <strong>"{boardToDelete.name}"</strong>?<br/>
              This will permanently delete all cards, drawings, and connection lines. This action cannot be undone.
            </p>

            {(boardToDelete.protectionMode === 'full' || boardToDelete.protectionMode === 'partial') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-rose)', fontWeight: 'bold' }}>
                  Authorization Required:
                </span>
                <input
                  type="password"
                  className="modal-input"
                  placeholder="Enter board password to authorize..."
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setBoardToDelete(null);
                  setDeletePassword('');
                }}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ background: 'var(--accent-rose)', boxShadow: '0 4px 14px rgba(244, 63, 94, 0.3)' }}
              >
                Delete
              </button>
            </div>
          </form>
        </div>
      )}
      {/* Control Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '450px', maxWidth: '90%', display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Settings size={20} color="var(--accent-indigo)" /> Control Settings
            </h2>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', lineHeight: '1.4', margin: 0 }}>
              Customize keybindings for navigation and mode toggles. Click any box and press a key to rebind it (press ESC to cancel).
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {Object.entries(keybindings).map(([bindName, binding]) => (
                <div 
                  key={bindName} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '0.6rem 0.8rem', 
                    background: 'rgba(255, 255, 255, 0.03)', 
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '8px'
                  }}
                >
                  <span style={{ fontSize: '0.9rem', color: 'var(--color-text-main)', fontWeight: 500 }}>
                    {binding.label}
                  </span>
                  <button
                    onClick={() => setActiveBindingKey(bindName)}
                    style={{
                      background: activeBindingKey === bindName ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                      border: activeBindingKey === bindName ? '1px solid var(--accent-indigo)' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      padding: '0.4rem 0.8rem',
                      color: activeBindingKey === bindName ? '#a5b4fc' : 'white',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      minWidth: '100px',
                      textAlign: 'center',
                      fontWeight: 600,
                      boxShadow: activeBindingKey === bindName ? '0 0 10px rgba(99, 102, 241, 0.2)' : 'none'
                    }}
                  >
                    {activeBindingKey === bindName ? 'Press key...' : binding.key.toUpperCase()}
                  </button>
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  const defaults = {
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
                  setKeybindings(defaults);
                  localStorage.setItem('dragg-keybindings', JSON.stringify(defaults));
                  showToast('Restored default controls.', 'info');
                }}
                style={{ marginRight: 'auto', background: 'rgba(244, 63, 94, 0.05)', color: '#fecdd3', border: '1px solid rgba(244, 63, 94, 0.2)' }}
              >
                Reset Defaults
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={() => setIsSettingsOpen(false)}
                style={{ background: 'var(--accent-indigo)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Import Notes Help & Template Guide Modal */}
      {showImportHelpModal && (
        <div 
          className="modal-overlay"
          onClick={() => setShowImportHelpModal(false)}
          style={{ zIndex: 2000 }}
        >
          <div 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '640px',
              maxWidth: '94%',
              maxHeight: '88vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              background: 'rgba(14, 14, 22, 0.96)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Info size={20} color="var(--accent-cyan)" />
                <div>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem', fontWeight: 700 }}>
                    Import Notes & Board Format Guide
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Automated Whiteboard Generator for Markdown & JSON
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setShowImportHelpModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: '1.5', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ margin: 0 }}>
                Import structured files to instantly generate complete interactive whiteboards! Supported formats: <strong style={{ color: '#38bdf8' }}>Markdown / Plain Text (.md, .txt)</strong> and <strong style={{ color: '#34d399' }}>Full Board JSON (.json)</strong>.
              </p>

              {/* Format 1: Structured Markdown / Text (.md) */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} /> Format 1: Markdown Notes (.md, .txt)
                  </h4>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const mdDemo = `# 🚀 API Gateway Service
Handles API routing, auth validation, and rate limiting.
Badge: ENTRY POINT
Tags: API, Gateway, Microservice
Type: note
Color: indigo

# 📊 PostgreSQL Database
Primary relational storage for user profiles and transactions.
Badge: DATABASE
Tags: Storage, Postgres, DB
Type: note
Color: emerald

# ⚡ JWT Verification Code
\`\`\`js
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; next();
  });
}
\`\`\`
Badge: SECURITY
Tags: Code, Auth, JWT
Type: code
Color: cyan

# 💡 Minimal Task Note
Quick deployment checklist note with minimal multiline card layout.
Type: minimal
Color: amber`;
                        navigator.clipboard.writeText(mdDemo);
                        showToast('Markdown demo template copied to clipboard!', 'success');
                      }}
                      className="glass-btn"
                      style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
                    >
                      Copy Demo .md
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const mdDemo = `# 🚀 API Gateway Service
Handles API routing, auth validation, and rate limiting.
Badge: ENTRY POINT
Tags: API, Gateway, Microservice
Type: note
Color: indigo

# 📊 PostgreSQL Database
Primary relational storage for user profiles and transactions.
Badge: DATABASE
Tags: Storage, Postgres, DB
Type: note
Color: emerald

# ⚡ JWT Verification Code
\`\`\`js
function verifyToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, process.env.SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; next();
  });
}
\`\`\`
Badge: SECURITY
Tags: Code, Auth, JWT
Type: code
Color: cyan

# 💡 Minimal Task Note
Quick deployment checklist note with minimal multiline card layout.
Type: minimal
Color: amber`;
                        const element = document.createElement('a');
                        const file = new Blob([mdDemo], {type: 'text/plain'});
                        element.href = URL.createObjectURL(file);
                        element.download = 'sample-dragg-notes.md';
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                        showToast('Downloaded sample-dragg-notes.md demo file!', 'success');
                      }}
                      className="glass-btn"
                      style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(56, 189, 248, 0.4)', color: '#38bdf8' }}
                    >
                      Download Demo .md
                    </button>
                  </div>
                </div>
                <pre style={{
                  background: 'rgba(0, 0, 0, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '0.7rem 0.9rem',
                  color: '#34d399',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  maxHeight: '160px'
                }}>
{`# API Gateway Service
Handles API routing and rate limiting.
Badge: ENTRY POINT
Tags: API, Gateway
Type: note
Color: indigo

# JWT Auth Controller
\`\`\`js
function verifyToken(req, res, next) { ... }
\`\`\`
Tags: Code, Auth
Type: code
Color: cyan`}
                </pre>
              </div>

              {/* Format 2: Full Board JSON (.json) */}
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: '#34d399', fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={16} /> Format 2: Full Board Backup (.json)
                  </h4>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const jsonDemo = JSON.stringify({
                          name: "E-Commerce Architecture Overview",
                          cards: [
                            {
                              id: "card_gw",
                              title: "API Gateway",
                              content: "Routes external client traffic to microservices.",
                              badge: { text: "GATEWAY", color: "#1d4ed8" },
                              tags: ["Traffic", "API"],
                              color: "indigo",
                              type: "note",
                              x: 100,
                              y: 150
                            },
                            {
                              id: "card_auth",
                              title: "Auth Service",
                              content: "OAuth2 & JWT authentication worker node.",
                              badge: { text: "MICROSERVICE", color: "#047857" },
                              tags: ["Auth", "Security"],
                              color: "emerald",
                              type: "note",
                              x: 460,
                              y: 150
                            }
                          ],
                          connections: [
                            { id: "c1", fromCardId: "card_gw", fromSide: "right", toCardId: "card_auth", toSide: "left" }
                          ]
                        }, null, 2);
                        navigator.clipboard.writeText(jsonDemo);
                        showToast('JSON demo template copied to clipboard!', 'success');
                      }}
                      className="glass-btn"
                      style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(52, 211, 153, 0.4)', color: '#34d399' }}
                    >
                      Copy Demo JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const jsonDemo = JSON.stringify({
                          name: "E-Commerce Architecture Overview",
                          cards: [
                            {
                              id: "card_gw",
                              title: "API Gateway",
                              content: "Routes external client traffic to microservices.",
                              badge: { text: "GATEWAY", color: "#1d4ed8" },
                              tags: ["Traffic", "API"],
                              color: "indigo",
                              type: "note",
                              x: 100,
                              y: 150
                            },
                            {
                              id: "card_auth",
                              title: "Auth Service",
                              content: "OAuth2 & JWT authentication worker node.",
                              badge: { text: "MICROSERVICE", color: "#047857" },
                              tags: ["Auth", "Security"],
                              color: "emerald",
                              type: "note",
                              x: 460,
                              y: 150
                            }
                          ],
                          connections: [
                            { id: "c1", fromCardId: "card_gw", fromSide: "right", toCardId: "card_auth", toSide: "left" }
                          ]
                        }, null, 2);
                        const element = document.createElement('a');
                        const file = new Blob([jsonDemo], {type: 'application/json'});
                        element.href = URL.createObjectURL(file);
                        element.download = 'sample-dragg-board.json';
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                        showToast('Downloaded sample-dragg-board.json demo file!', 'success');
                      }}
                      className="glass-btn"
                      style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(52, 211, 153, 0.4)', color: '#34d399' }}
                    >
                      Download Demo .json
                    </button>
                  </div>
                </div>
                <pre style={{
                  background: 'rgba(0, 0, 0, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  padding: '0.7rem 0.9rem',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  maxHeight: '160px'
                }}>
{`{
  "name": "E-Commerce Architecture Overview",
  "cards": [
    {
      "id": "card_gw",
      "title": "API Gateway",
      "content": "Routes external client traffic to microservices.",
      "badge": { "text": "GATEWAY" },
      "tags": ["Traffic", "API"],
      "color": "indigo",
      "x": 100, "y": 150
    }
  ]
}`}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.4rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '0.8rem' }}>
              <button
                onClick={() => setShowImportHelpModal(false)}
                className="btn btn-primary"
                style={{ fontSize: '0.85rem', padding: '0.5rem 1.2rem', background: 'var(--accent-indigo)', borderRadius: '8px' }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* What's New Modal */}
      {showWhatsNewModal && (
        <div 
          className="modal-overlay"
          onClick={handleCloseWhatsNew}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem'
          }}
        >
          <div 
            className="modal-container whats-new-modal-container glass"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '650px',
              width: '94vw',
              maxHeight: '85vh',
              maxHeight: '85dvh',
              overflowY: 'auto',
              background: 'rgba(15, 15, 25, 0.95)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              borderRadius: '16px',
              padding: '1.4rem 1.2rem',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(168, 85, 247, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              color: '#ffffff',
              boxSizing: 'border-box'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, background: 'linear-gradient(90deg, #ffffff, #a5b4fc, #e9d5ff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    What's New in Dragg 🚀
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    Latest Feature Release & Canvas Power Tools
                  </span>
                </div>
              </div>
              <button
                onClick={handleCloseWhatsNew}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Feature Cards Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {/* Feature 1: Dedicated Board Architecture */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <Layers size={18} style={{ color: '#10b981' }} />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#a7f3d0' }}>
                    Freestyle & System Design Board Architecture
                  </h4>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Separate board modes built for distinct workflows! <strong>Freestyle Boards</strong> feature full whiteboards with notes, minimal cards, and sketches. <strong>System Design Canvas</strong> provides an exclusive clean slate for system architecture.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#a7f3d0', padding: '2px 8px', borderRadius: '6px' }}>
                    Freestyle Engine
                  </span>
                  <span style={{ fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.2)', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#fef08a', padding: '2px 8px', borderRadius: '6px' }}>
                    System Design (Dev Mode)
                  </span>
                </div>
              </div>

              {/* Feature 2: Structured File Import (.json, .md, .txt) */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <FileText size={18} style={{ color: '#38bdf8' }} />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#bae6fd' }}>
                    Automated File Import (.json, .md, .txt)
                  </h4>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Instantly import structured markdown files, note text, or full board JSON backups directly from the Dashboard to generate pre-configured whiteboards in seconds.
                </p>
              </div>

              {/* Feature 3: Smart Tag & Feature Configuration */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <MousePointerClick size={18} style={{ color: '#a855f7' }} />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#e9d5ff' }}>
                    Normalized Badges & Feature Control
                  </h4>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Enhanced card feature toggles (Notes, Sketch, Attachments, Tags) and badge normalizers for ghost-free tag pill rendering and clean bottom layout padding.
                </p>
              </div>

              {/* Feature 4: Multi-Card Marquee Select & Group Movement */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <BoxSelect size={18} style={{ color: '#38bdf8' }} />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#bae6fd' }}>
                    Multi-Card Box Select & Group Movement
                  </h4>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Switch to <strong>Box Select Mode (M)</strong> to draw a marquee selection rectangle over multiple cards. Selected cards lock inside a glassmorphic container with a floating drag handle!
                </p>
              </div>

              {/* Feature 5: Dynamic Connection Path Highlight */}
              <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <Compass size={18} style={{ color: 'var(--accent-cyan)' }} />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#e0f2fe' }}>
                    Dynamic Connection Path Highlight
                  </h4>
                </div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: '1.5' }}>
                  Right-click a card and select <strong>View Connection Path</strong> to animate downstream connections from left to right in a slow, cinematic cascade.
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.6rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button
                onClick={handleCloseWhatsNew}
                className="btn btn-primary"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  padding: '0.5rem 1.2rem',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Explore Features
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
