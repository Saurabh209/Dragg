import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Hand, FileText, Lock, Eye, Settings, Link2, Pencil, Image as ImageIcon } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function Dashboard({ onSelectBoard, showToast }) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardPassword, setNewBoardPassword] = useState('');
  const [newBoardProtectionMode, setNewBoardProtectionMode] = useState('none');
  
  // Board unlock modal states (when clicking fully protected board)
  const [boardToUnlock, setBoardToUnlock] = useState(null);
  const [unlockPassword, setUnlockPassword] = useState('');

  // Custom delete confirmation state
  const [boardToDelete, setBoardToDelete] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [forceViewOnlyPending, setForceViewOnlyPending] = useState(false);

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
      setBoards(data);
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
      const res = await fetch(`${API_BASE}/boards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newBoardName.trim(),
          password: newBoardPassword,
          protectionMode: newBoardProtectionMode
        }),
      });
      if (!res.ok) throw new Error('Failed to create board');
      const data = await res.json();
      showToast(`Board "${data.name}" created!`);
      
      const p = data.hashedPassword || newBoardPassword;
      if (p) {
        localStorage.setItem(`dragg-board-pass-${data._id}`, p);
      }
      
      setNewBoardName('');
      setNewBoardPassword('');
      setNewBoardProtectionMode('none');
      setIsModalOpen(false);
      
      onSelectBoard(data._id, p || '', false);
    } catch (err) {
      console.error(err);
      showToast('Failed to create board.', 'error');
    }
  };

  const handleBoardClick = async (board) => {
    if (board.protectionMode === 'full') {
      const savedHash = localStorage.getItem(`dragg-board-pass-${board._id}`);
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
              // Successfully auto-verified saved hash!
              onSelectBoard(board._id, savedHash, false);
              return;
            }
          }
        } catch (err) {
          console.error('Error auto-verifying password:', err);
        }
        // If verify fails, remove the invalid hash
        localStorage.removeItem(`dragg-board-pass-${board._id}`);
      }
      setBoardToUnlock(board);
      setUnlockPassword('');
    } else {
      // Partial lock - pass the saved hash if we have one so they don't see View Only state
      const savedHash = localStorage.getItem(`dragg-board-pass-${board._id}`);
      onSelectBoard(board._id, savedHash || '', false);
    }
  };

  const handleViewOnlyClick = (board) => {
    const savedHash = localStorage.getItem(`dragg-board-pass-${board._id}`) || '';
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
      const res = await fetch(`${API_BASE}/boards/${boardToUnlock._id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: unlockPassword }),
      });
      if (!res.ok) throw new Error('Password verification failed');
      const data = await res.json();
      if (data.success) {
        showToast('Access granted.');
        const boardId = boardToUnlock._id;
        const passToUse = data.hashedPassword || unlockPassword;
        // Save the hash to localStorage
        localStorage.setItem(`dragg-board-pass-${boardId}`, passToUse);
        setBoardToUnlock(null);
        setUnlockPassword('');
        onSelectBoard(boardId, passToUse, forceViewOnlyPending);
        setForceViewOnlyPending(false); // reset
      } else {
        showToast('Incorrect password.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error validating password.', 'error');
    }
  };

  const handleDeleteBoard = async (e) => {
    if (e) e.preventDefault();
    if (!boardToDelete) return;
    const { _id: id, name, protectionMode } = boardToDelete;

    try {
      const headers = {};
      if (protectionMode === 'full' || protectionMode === 'partial') {
        headers['x-board-password'] = deletePassword;
      }

      const res = await fetch(`${API_BASE}/boards/${id}`, { 
        method: 'DELETE',
        headers
      });
      
      if (res.status === 401) {
        showToast('Incorrect password. Authorization failed.', 'error');
        return;
      }
      if (!res.ok) throw new Error('Failed to delete board');
      
      showToast(`Board "${name}" deleted.`);
      localStorage.removeItem(`dragg-board-pass-${id}`); // Clean up password hash
      setBoards((prev) => prev.filter((b) => b._id !== id));
      setBoardToDelete(null);
      setDeletePassword('');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete board.', 'error');
    }
  };

  // Structured Notes text file parser
  const parseNotesText = (text, fileName) => {
    const lines = text.split(/\r?\n/);
    const boardName = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    const board = {
      name: boardName,
      cards: [],
      connections: [],
      pan: { x: 200, y: 150 },
      zoom: 0.85
    };

    let currentCard = null;
    let inCodeBlock = false;
    let codeLines = [];

    const createNewCard = (title) => {
      return {
        id: Math.random().toString(36).substring(2, 11),
        title: title || 'Untitled Card',
        content: '',
        code: '',
        tags: [],
        color: 'slate',
        type: 'note',
        cardMode: 'notes',
        width: 250,
        height: 180
      };
    };

    lines.forEach((line) => {
      const trimmed = line.trim();

      // Treat any heading line (starting with #, ##, ###) as a new card
      if (trimmed.startsWith('#')) {
        const cardTitle = trimmed.replace(/^#+\s*/, '');
        currentCard = createNewCard(cardTitle);
        
        // Auto-position cards horizontally in a line to avoid overlap
        const cardIndex = board.cards.length;
        currentCard.x = cardIndex * 360;
        currentCard.y = 150;

        // Visual Colors Cycle
        const colors = ['slate', 'indigo', 'cyan', 'emerald', 'amber', 'rose'];
        currentCard.color = colors[cardIndex % colors.length];

        board.cards.push(currentCard);
        return;
      }

      // If no card is active, ignore text or auto-create an Introduction card
      if (!currentCard) {
        if (trimmed.length > 0) {
          currentCard = createNewCard('Introduction');
          currentCard.x = 0;
          currentCard.y = 150;
          board.cards.push(currentCard);
        } else {
          return;
        }
      }

      // Check for Code Block boundaries
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          currentCard.code = codeLines.join('\n');
          currentCard.cardMode = 'code'; // Automatically default workspace to Code tab
          codeLines = [];
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeLines.push(line); // Preserve leading spaces for code indentation!
        return;
      }

      // Check for tags: e.g. "Tags: scope, lexical"
      if (trimmed.toLowerCase().startsWith('tags:')) {
        const tagList = trimmed.substring(5).split(',').map((t) => t.trim()).filter(Boolean);
        currentCard.tags = [...new Set([...currentCard.tags, ...tagList])];
        return;
      }

      // Append content text description
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

    return [board]; // Return inside a single-element list to match REST creator loop
  };

  const handleImportNotesFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const parsedBoards = parseNotesText(text, file.name);

      if (parsedBoards.length === 0) {
        showToast('No valid boards or cards found in text file.', 'error');
        return;
      }

      showToast(`Generating ${parsedBoards.length} board(s)...`);

      try {
        for (const pb of parsedBoards) {
          // 1. Create the board
          const createRes = await fetch(`${API_BASE}/boards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: pb.name }),
          });
          if (!createRes.ok) throw new Error('Failed to create board during import');
          const data = await createRes.json();

          // 2. Populate the board with parsed cards & connections
          const updateRes = await fetch(`${API_BASE}/boards/${data._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: pb.name,
              cards: pb.cards,
              connections: pb.connections,
              drawings: [],
              pan: pb.pan,
              zoom: pb.zoom
            }),
          });
          if (!updateRes.ok) throw new Error('Failed to update board details during import');
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

  return (
    <div className="dashboard-container">
      {/* Controls settings button in the top-right corner of the container */}
      <button 
        className="dashboard-settings-btn glass"
        onClick={() => setIsSettingsOpen(true)}
        title="Control Settings"
        style={{
          position: 'absolute',
          top: '2rem',
          right: '2rem',
          padding: '0.6rem 0.9rem',
          borderRadius: '12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          color: 'var(--color-text-main)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(255, 255, 255, 0.03)',
          zIndex: 10
        }}
      >
        <Settings size={15} />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Controls</span>
      </button>

      <header className="dashboard-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <Hand size={36} color="var(--accent-indigo)" style={{ transform: 'rotate(-10deg)' }} />
          <h1 className="dashboard-title" style={{ margin: 0 }}>dragg</h1>
        </div>
        <p className="dashboard-subtitle">Create, design, and connect ideas on a free-form board</p>
      </header>

      {/* Creation/Import Actions Row */}
      <div 
        className="dashboard-actions-bar"
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '2.5rem',
          width: '100%',
          maxWidth: '1100px',
          justifyContent: 'flex-start',
          alignItems: 'center'
        }}
      >
        <button 
          className="btn btn-primary"
          onClick={() => setIsModalOpen(true)}
          style={{
            background: 'var(--accent-indigo)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
            cursor: 'pointer',
            border: 'none',
            color: 'white'
          }}
        >
          <Plus size={16} />
          Create New Board
        </button>

        <label 
          className="btn btn-secondary glass"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            borderRadius: '10px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.03)',
            color: 'var(--color-text-main)'
          }}
          title="Import boards from structured text file (.txt, .md)"
        >
          <FileText size={16} color="var(--accent-cyan)" />
          <span>Import Notes</span>
          <input 
            type="file" 
            accept=".txt,.md" 
            onChange={handleImportNotesFile} 
            style={{ display: 'none' }} 
          />
        </label>
      </div>

      <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.6rem' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white', margin: 0, fontFamily: 'var(--font-heading)' }}>Whiteboards</h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{boards.length} total</span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem' }}>Loading boards...</div>
      ) : (
        <div className="dashboard-grid">
          {boards.length === 0 ? (
            <div 
              style={{ 
                gridColumn: '1 / -1', 
                textAlign: 'center', 
                padding: '4rem 2rem', 
                color: 'var(--color-text-muted)', 
                background: 'rgba(255, 255, 255, 0.01)', 
                border: '1px dashed rgba(255, 255, 255, 0.1)', 
                borderRadius: '16px',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              No whiteboards found. Click "Create New Board" or "Import Notes" above to get started!
            </div>
          ) : (
            boards.map((board) => {
              const cardCount = board.cards?.length || 0;
              const noteCount = board.cards?.filter(c => c.type === 'note').length || 0;
              const imageCount = board.cards?.filter(c => c.type === 'image').length || 0;
              const linkCount = board.connections?.length || 0;
              const strokeCount = board.drawings?.length || 0;

              return (
                <div 
                  key={board._id} 
                  className="board-card detailed-board-card glass"
                  onClick={() => handleBoardClick(board)}
                >
                  <div className="board-card-header-row">
                    <span className="board-card-name-text" title={board.name}>
                      {board.name}
                    </span>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      {board.protectionMode === 'full' && (
                        <Lock size={13} color="var(--accent-rose)" title="Fully Password Protected" />
                      )}
                      {board.protectionMode === 'partial' && (
                        <Eye size={13} color="var(--accent-cyan)" title="Partially Protected (View Only)" />
                      )}
                    </div>
                  </div>

                  <div className="board-card-stats-grid">
                    <div className="board-stat-chip" title={`${noteCount} Note Cards`}>
                      <FileText size={11} color="var(--accent-indigo)" />
                      <span>{noteCount} {noteCount === 1 ? 'Note' : 'Notes'}</span>
                    </div>
                    <div className="board-stat-chip" title={`${imageCount} Image Assets`}>
                      <ImageIcon size={11} color="var(--accent-cyan)" />
                      <span>{imageCount} {imageCount === 1 ? 'Image' : 'Images'}</span>
                    </div>
                    <div className="board-stat-chip" title={`${linkCount} Connection Paths`}>
                      <Link2 size={11} color="var(--accent-emerald)" />
                      <span>{linkCount} {linkCount === 1 ? 'Link' : 'Links'}</span>
                    </div>
                    {strokeCount > 0 && (
                      <div className="board-stat-chip" title={`${strokeCount} Sketches`}>
                        <Pencil size={11} color="var(--accent-amber)" />
                        <span>{strokeCount} {strokeCount === 1 ? 'Sketch' : 'Sketches'}</span>
                      </div>
                    )}
                  </div>

                  <div className="board-card-info-row">
                    <div className="board-card-date" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Calendar size={12} />
                      <span>{formatDate(board.updatedAt)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {(board.protectionMode === 'full' || board.protectionMode === 'partial') && (
                        <button
                          className="board-card-delete-btn-cyan"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewOnlyClick(board);
                          }}
                          title="Open in View Only Mode (Read Only)"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            padding: '0.4rem',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(el) => {
                            el.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)';
                            el.currentTarget.style.color = 'var(--accent-cyan)';
                          }}
                          onMouseLeave={(el) => {
                            el.currentTarget.style.background = 'transparent';
                            el.currentTarget.style.color = 'var(--color-text-muted)';
                          }}
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      
                      <button 
                        className="board-card-delete-btn-red"
                        onClick={(e) => {
                          e.stopPropagation(); // Stop card selection click
                          setBoardToDelete(board);
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

      {/* Create Board Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsModalOpen(false);
          setNewBoardPassword('');
          setNewBoardProtectionMode('none');
        }}>
          <form 
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateBoard}
            style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
          >
            <h2 className="modal-title">Create New Board</h2>
            <input 
              type="text" 
              className="modal-input" 
              placeholder="Board name..." 
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              autoFocus
              required
            />
            
            <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.2rem' }}>
              Protection Mode
              <select
                className="modal-select"
                value={newBoardProtectionMode}
                onChange={(e) => {
                  setNewBoardProtectionMode(e.target.value);
                  if (e.target.value === 'none') setNewBoardPassword('');
                }}
              >
                <option value="none">Public (Unprotected)</option>
                <option value="partial">Partial Lock (View Only, edits need password)</option>
                <option value="full">Full Lock (Password needed to enter board)</option>
              </select>
            </label>

            {newBoardProtectionMode !== 'none' && (
              <input
                type="password"
                className="modal-input"
                placeholder="Set Board Password..."
                value={newBoardPassword}
                onChange={(e) => setNewBoardPassword(e.target.value)}
                required
                style={{ marginTop: '0.2rem' }}
              />
            )}

            <div className="modal-actions" style={{ marginTop: '0.6rem' }}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => {
                  setIsModalOpen(false);
                  setNewBoardPassword('');
                  setNewBoardProtectionMode('none');
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
    </div>
  );
}

export default Dashboard;
