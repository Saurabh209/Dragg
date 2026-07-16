import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Palette, Plus, X, Link2, Pencil, Eraser, FileText, Code2, RefreshCw, GripHorizontal, Paperclip, Download, Image, Play, Check, Box } from 'lucide-react';

const COLORS = [
  { name: 'slate', value: 'var(--accent-slate)' },
  { name: 'indigo', value: 'var(--accent-indigo)' },
  { name: 'cyan', value: 'var(--accent-cyan)' },
  { name: 'emerald', value: 'var(--accent-emerald)' },
  { name: 'amber', value: 'var(--accent-amber)' },
  { name: 'rose', value: 'var(--accent-rose)' },
];

const MIN_WIDTH = 220;
const MIN_HEIGHT = 160;

export const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript (Node)', ext: 'js', version: '18.15.0' },
  { id: 'typescript', name: 'TypeScript', ext: 'ts', version: '5.0.3' },
  { id: 'python', name: 'Python 3', ext: 'py', version: '3.10.0' },
  { id: 'c++', name: 'C++', ext: 'cpp', version: '10.2.0' },
  { id: 'java', name: 'Java', ext: 'java', version: '15.0.2' },
  { id: 'go', name: 'Go', ext: 'go', version: '1.16.2' },
  { id: 'rust', name: 'Rust', ext: 'rs', version: '1.68.2' },
  { id: 'csharp', name: 'C#', ext: 'cs', version: '6.12.0' },
  { id: 'ruby', name: 'Ruby', ext: 'rb', version: '3.0.0' },
  { id: 'php', name: 'PHP', ext: 'php', version: '8.2.3' },
  { id: 'bash', name: 'Bash', ext: 'sh', version: '5.2.0' }
];

const hexToRgba = (hex, opacity) => {
  if (!hex) return '';
  if (!hex.startsWith('#')) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const getPlaceholderForLang = (lang) => {
  switch (lang) {
    case 'python':
      return '# Write Python code here\nprint("Hello, Python!")';
    case 'c++':
      return '// Write C++ code here\n#include <iostream>\nusing namespace std;\nint main() {\n    cout << "Hello, C++!" << endl;\n    return 0;\n}';
    case 'java':
      return '// Write Java code here\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java!");\n    }\n}';
    case 'go':
      return '// Write Go code here\npackage main\nimport "fmt"\nfunc main() {\n    fmt.Println("Hello, Go!")\n}';
    case 'rust':
      return '// Write Rust code here\nfn main() {\n    println!("Hello, Rust!");\n}';
    case 'typescript':
      return '// Write TypeScript code here\nconst greeting: string = "Hello, TypeScript!";\nconsole.log(greeting);';
    case 'csharp':
      return '// Write C# code here\nusing System;\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, C#!");\n    }\n}';
    case 'ruby':
      return '# Write Ruby code here\nputs "Hello, Ruby!"';
    case 'php':
      return '<?php\n// Write PHP code here\necho "Hello, PHP!";\n?>';
    case 'bash':
      return '# Write Bash commands here\necho "Hello, Bash!"\npwd';
    default:
      return '// Write JavaScript code here\nconsole.log("Hello, World!");';
  }
};

function Card({ 
  card, 
  isSelected, 
  onSelect, 
  onUpdate, 
  onDelete, 
  zoom, 
  onStartConnection,
  toolMode, // 'select' | 'connector' | 'pen' | 'ruler'
  isViewOnly = false,
  isBlinking = false,
  onDoubleClickFocus
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [isEditingTag, setIsEditingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  
  // Sketch states
  const [sketchColor, setSketchColor] = useState('#ffffff');
  const [sketchTool, setSketchTool] = useState('draw'); // 'draw' | 'erase'

  // Code compiler states
  const [isRunning, setIsRunning] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [consoleError, setConsoleError] = useState(false);

  const cardRef = useRef(null);
  const canvasRef = useRef(null);
  const editorRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastCoordsRef = useRef({ x: 0, y: 0 });

  const [localCardMode, setLocalCardMode] = useState(null);
  const activeMode = localCardMode || card.cardMode || 'notes';

  // Text Editor Selection & Formatting Helpers
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange();
      }
    }
  };

  const restoreSelection = () => {
    if (savedSelectionRef.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
      editorRef.current?.focus();
    }
  };

  const handleEditorInput = () => {
    if (editorRef.current) {
      onUpdate(card.id, { content: editorRef.current.innerHTML });
    }
  };

  const cleanFragmentStyles = (fragment, styleName) => {
    if (!fragment) return;
    const elements = Array.from(fragment.querySelectorAll('*'));
    elements.forEach((el) => {
      if (el.style && el.style[styleName]) {
        el.style[styleName] = '';
        if (el.tagName === 'SPAN' && el.style.length === 0 && !el.className && !el.id) {
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        }
      }
    });
  };

  const applySpanStyle = (styleName, styleValue) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    if (editorRef.current && !editorRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    const span = document.createElement('span');
    span.style[styleName] = styleValue;
    
    try {
      const fragment = range.extractContents();
      cleanFragmentStyles(fragment, styleName);
      span.appendChild(fragment);
      range.insertNode(span);
    } catch (e) {
      const selectedText = range.toString();
      span.textContent = selectedText;
      range.deleteContents();
      range.insertNode(span);
    }

    // Post-normalization: Clean any empty spans inside the entire editor
    if (editorRef.current) {
      const emptySpans = Array.from(editorRef.current.querySelectorAll('span'));
      emptySpans.forEach((el) => {
        if (el.style.length === 0 && !el.className && !el.id) {
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) {
              parent.insertBefore(el.firstChild, el);
            }
            parent.removeChild(el);
          }
        }
      });
    }

    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNode(span);
    selection.addRange(newRange);
    saveSelection();

    if (editorRef.current) {
      onUpdate(card.id, { content: editorRef.current.innerHTML });
    }
  };

  const handleBoldClick = (e) => {
    e.preventDefault();
    restoreSelection();
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0 && editorRef.current?.contains(selection.anchorNode);
    
    if (hasSelection) {
      document.execCommand('bold', false);
      saveSelection();
      if (editorRef.current) {
        onUpdate(card.id, { content: editorRef.current.innerHTML });
      }
    } else {
      onUpdate(card.id, { notesFontWeight: card.notesFontWeight === 'bold' ? 'normal' : 'bold' });
    }
  };

  const handleItalicClick = (e) => {
    e.preventDefault();
    restoreSelection();
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0 && editorRef.current?.contains(selection.anchorNode);
    
    if (hasSelection) {
      document.execCommand('italic', false);
      saveSelection();
      if (editorRef.current) {
        onUpdate(card.id, { content: editorRef.current.innerHTML });
      }
    } else {
      onUpdate(card.id, { notesFontStyle: card.notesFontStyle === 'italic' ? 'normal' : 'italic' });
    }
  };

  const handleUnderlineClick = (e) => {
    e.preventDefault();
    restoreSelection();
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0 && editorRef.current?.contains(selection.anchorNode);
    
    if (hasSelection) {
      document.execCommand('underline', false);
      saveSelection();
      if (editorRef.current) {
        onUpdate(card.id, { content: editorRef.current.innerHTML });
      }
    } else {
      onUpdate(card.id, { notesTextDecoration: card.notesTextDecoration === 'underline' ? 'none' : 'underline' });
    }
  };

  const handleTextColorChange = (e) => {
    const val = e.target.value;
    restoreSelection();
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0 && editorRef.current?.contains(selection.anchorNode);
    
    if (hasSelection) {
      const colorMap = {
        cyan: '#06b6d4',
        emerald: '#10b981',
        amber: '#f59e0b',
        rose: '#f43f5e',
        default: '#ffffff',
      };
      const actualColor = colorMap[val] || val;
      document.execCommand('foreColor', false, actualColor);
      saveSelection();
      if (editorRef.current) {
        onUpdate(card.id, { content: editorRef.current.innerHTML });
      }
    } else {
      onUpdate(card.id, { notesTextColor: val });
    }
  };

  const handleFontSizeChange = (e) => {
    const val = e.target.value;
    restoreSelection();
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0 && editorRef.current?.contains(selection.anchorNode);
    
    if (hasSelection) {
      const sizeMap = {
        small: '12px',
        medium: '14px',
        large: '18px',
        xl: '24px'
      };
      const finalSize = sizeMap[val] || val;
      applySpanStyle('fontSize', finalSize);
    } else {
      onUpdate(card.id, { notesFontSize: val });
    }
  };

  const handleFontFamilyChange = (e) => {
    const val = e.target.value;
    restoreSelection();
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0 && editorRef.current?.contains(selection.anchorNode);
    
    if (hasSelection) {
      const familyMap = {
        sans: 'var(--font-body)',
        serif: 'Georgia, serif',
        mono: 'Courier New, Courier, monospace'
      };
      applySpanStyle('fontFamily', familyMap[val] || 'var(--font-body)');
    } else {
      onUpdate(card.id, { notesFontFamily: val });
    }
  };


  const handleContainerBoxClick = (e) => {
    e.preventDefault();
    restoreSelection();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    if (editorRef.current && !editorRef.current.contains(range.commonAncestorContainer)) {
      return;
    }

    const box = document.createElement('div');
    box.className = 'notes-callout-box';
    box.style.display = 'block';
    
    // Add delete button element inside the callout box
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'notes-callout-delete';
    deleteBtn.contentEditable = 'false';
    deleteBtn.innerText = '×';
    deleteBtn.title = 'Delete container';
    box.appendChild(deleteBtn);

    try {
      if (range.collapsed) {
        const textNode = document.createTextNode('Type inside container...');
        box.appendChild(textNode);
      } else {
        box.appendChild(range.extractContents());
      }
      range.insertNode(box);
      
      selection.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(box);
      // Place cursor in the text area of the box, skipping the close button
      if (box.childNodes.length > 1) {
        newRange.setStart(box, 1);
        newRange.setEnd(box, box.childNodes.length);
      }
      selection.addRange(newRange);
      saveSelection();

      if (editorRef.current) {
        onUpdate(card.id, { content: editorRef.current.innerHTML });
      }
    } catch (err) {
      console.error('Failed to insert container box:', err);
    }
  };

  const ensureCalloutDeleteButtons = () => {
    if (!editorRef.current) return;
    const callouts = editorRef.current.querySelectorAll('.notes-callout-box');
    let modified = false;
    callouts.forEach(box => {
      if (!box.querySelector('.notes-callout-delete')) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'notes-callout-delete';
        deleteBtn.contentEditable = 'false';
        deleteBtn.innerText = '×';
        deleteBtn.title = 'Delete container';
        box.insertBefore(deleteBtn, box.firstChild);
        modified = true;
      }
    });
    if (modified && editorRef.current) {
      onUpdate(card.id, { content: editorRef.current.innerHTML });
    }
  };

  // Sync editor content when it changes outside of this focus context
  useEffect(() => {
    if (editorRef.current && activeMode === 'notes') {
      const isFocused = document.activeElement === editorRef.current;
      const isFormatBarInteracting = document.activeElement?.closest('.notes-format-bar') || 
                                     document.activeElement?.closest('.notes-floating-format-bar') || 
                                     false;
      
      if (!isFocused && !isFormatBarInteracting && editorRef.current.innerHTML !== (card.content || '')) {
        editorRef.current.innerHTML = card.content || '';
        ensureCalloutDeleteButtons();
      }
    }
  }, [card.content, activeMode]);

  // Ensure callout delete buttons are present on mount or mode changes
  useEffect(() => {
    if (editorRef.current && activeMode === 'notes') {
      ensureCalloutDeleteButtons();
    }
  }, [activeMode]);

  // Redraw card sketch whenever card size, drawingUrl, or mode changes
  useEffect(() => {
    if (card.type === 'note' && activeMode === 'sketch') {
      redrawSketch();
    }
  }, [card.width, card.height, activeMode, card.drawingDataUrl]);

  const redrawSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Standardize canvas dimensions to match CSS dimensions
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    ctx.clearRect(0, 0, rect.width, rect.height);

    if (card.drawingDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = card.drawingDataUrl;
    }
  };

  // Card interaction mouse down
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    
    if (isViewOnly) {
      onSelect(card.id);
      return;
    }
    
    // Don't drag/connect if clicking inside interactive fields
    if (
      e.target.tagName === 'INPUT' || 
      e.target.tagName === 'TEXTAREA' || 
      e.target.tagName === 'CANVAS' ||
      e.target.closest('.card-content-textarea') ||
      e.target.closest('[contenteditable]') ||
      e.target.closest('.card-tab-btn') ||
      e.target.closest('.card-action-btn') || 
      e.target.closest('.tag-badge') || 
      e.target.closest('.tag-input-trigger') ||
      e.target.closest('.color-dot') ||
      e.target.closest('.card-sketch-toolbar') ||
      e.target.closest('.notes-format-bar')
    ) {
      return;
    }

    e.stopPropagation();
    onSelect(card.id);

    // If connector mode is active, dragging from anywhere on the card draws a connection line
    if (toolMode === 'connector') {
      e.preventDefault();
      onStartConnection(card.id, 'right', e);
      return;
    }

    // Otherwise translate the card (Drag & Move)
    if (e.target.closest('.resize-handle') || e.target.closest('.connection-node')) return;
    
    e.preventDefault();

    const startX = card.x;
    const startY = card.y;
    const clientStartX = e.clientX;
    const clientStartY = e.clientY;

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - clientStartX;
      const dy = moveEvent.clientY - clientStartY;

      // Adjust delta by zoom scale
      const newX = startX + dx / zoom;
      const newY = startY + dy / zoom;

      onUpdate(card.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 8-Way Card Resize controller
  const handleResizeMouseDown = (direction, e) => {
    if (isViewOnly) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(card.id);

    const startX = card.x;
    const startY = card.y;
    const startWidth = card.width || 250;
    const startHeight = card.height || 200;
    
    const clientStartX = e.clientX;
    const clientStartY = e.clientY;

    const handleMouseMove = (moveEvent) => {
      let dx = (moveEvent.clientX - clientStartX) / zoom;
      let dy = (moveEvent.clientY - clientStartY) / zoom;

      let nextX = startX;
      let nextY = startY;
      let nextW = startWidth;
      let nextH = startHeight;

      // Horizontal resizing logic
      if (direction.includes('r')) {
        nextW = Math.max(MIN_WIDTH, startWidth + dx);
      } else if (direction.includes('l')) {
        const maxDx = startWidth - MIN_WIDTH;
        const actualDx = Math.min(maxDx, dx);
        nextW = startWidth - actualDx;
        nextX = startX + actualDx;
      }

      // Vertical resizing logic
      if (direction.includes('b')) {
        nextH = Math.max(MIN_HEIGHT, startHeight + dy);
      } else if (direction.includes('t')) {
        const maxDy = startHeight - MIN_HEIGHT;
        const actualDy = Math.min(maxDy, dy);
        nextH = startHeight - actualDy;
        nextY = startY + actualDy;
      }

      onUpdate(card.id, {
        x: nextX,
        y: nextY,
        width: nextW,
        height: nextH
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Header quick connector button click handler
  const handleQuickConnectMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(card.id);
    onStartConnection(card.id, 'right', e);
  };

  // Monospace Code Editor Tab key handler
  const handleCodeKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target;
      const { selectionStart, selectionEnd, value } = textarea;
      const newValue = value.substring(0, selectionStart) + '  ' + value.substring(selectionEnd);
      
      onUpdate(card.id, { code: newValue });
      
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = selectionStart + 2;
      }, 0);
    }
  };

  // Compile & execute sandbox code
  const handleRunCode = async (e) => {
    e.stopPropagation();
    const langId = card.language || 'javascript';
    const selectedLang = LANGUAGES.find(l => l.id === langId) || LANGUAGES[0];
    
    setIsRunning(true);
    setConsoleOutput('Executing code on secure runtime container...');
    setConsoleError(false);

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
              content: card.code || ''
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
          setConsoleOutput(stderr);
          setConsoleError(true);
        } else if (stdout) {
          setConsoleOutput(stdout);
          setConsoleError(false);
        } else {
          setConsoleOutput(`Process finished with exit code ${code} (No output produced)`);
          setConsoleError(false);
        }
      } else {
        setConsoleOutput('Could not run code: Invalid API response format.');
        setConsoleError(true);
      }
    } catch (err) {
      console.error(err);
      if (selectedLang.id === 'javascript') {
        setConsoleOutput('Secure container unreachable. Running code in local browser sandbox...\n');
        try {
          const logs = [];
          const originalLog = console.log;
          const originalError = console.error;
          const originalWarn = console.warn;
          const originalTime = console.time;
          const originalTimeEnd = console.timeEnd;
          
          const timers = {};
          
          console.log = (...args) => {
            logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
          };
          console.error = (...args) => {
            logs.push('[Error] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
          };
          console.warn = (...args) => {
            logs.push('[Warning] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
          };
          console.time = (label = 'default') => {
            timers[label] = performance.now();
          };
          console.timeEnd = (label = 'default') => {
            if (timers[label]) {
              const duration = performance.now() - timers[label];
              logs.push(`${label}: ${duration.toFixed(3)}ms`);
              delete timers[label];
            } else {
              logs.push(`Timer "${label}" does not exist`);
            }
          };

          // Run code in an isolated function wrapper
          const runFn = new Function(card.code || '');
          runFn();

          // Restore console functions
          console.log = originalLog;
          console.error = originalError;
          console.warn = originalWarn;
          console.time = originalTime;
          console.timeEnd = originalTimeEnd;

          setConsoleOutput(logs.join('\n') || '(No output produced)');
          setConsoleError(false);
        } catch (jsErr) {
          setConsoleOutput(`Local Execution Error: ${jsErr.message}`);
          setConsoleError(true);
        }
      } else {
        setConsoleOutput(`Execution Error: ${err.message}`);
        setConsoleError(true);
      }
    } finally {
      setIsRunning(false);
    }
  };

  // Mini Drawing Canvas mouse handlers inside Card Sandbox
  const getCanvasMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Do not scale by board zoom here, since client coordinates are bounding box relative
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleSketchMouseDown = (e) => {
    if (e.button !== 0) return;
    if (isViewOnly) return;
    e.stopPropagation();
    isDrawingRef.current = true;
    const pos = getCanvasMousePos(e);
    lastCoordsRef.current = pos;
  };

  const handleSketchMouseMove = (e) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasMousePos(e);

    ctx.beginPath();
    ctx.moveTo(lastCoordsRef.current.x, lastCoordsRef.current.y);
    ctx.lineTo(pos.x, pos.y);

    if (sketchTool === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = 15;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = sketchColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }

    ctx.stroke();
    lastCoordsRef.current = pos;
  };

  const handleSketchMouseUpOrLeave = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    
    // Save drawing to card state
    const canvas = canvasRef.current;
    if (canvas) {
      onUpdate(card.id, { drawingDataUrl: canvas.toDataURL() });
    }
  };

  const handleClearSketch = (e) => {
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onUpdate(card.id, { drawingDataUrl: '' });
    }
  };

  // Tag Management
  const handleAddTag = (e) => {
    e.preventDefault();
    const cleanTag = newTag.trim();
    if (cleanTag && !card.tags.includes(cleanTag)) {
      onUpdate(card.id, { tags: [...card.tags, cleanTag] });
    }
    setNewTag('');
    setIsEditingTag(false);
  };

  const handleRemoveTag = (tagToRemove) => {
    onUpdate(card.id, { tags: card.tags.filter((t) => t !== tagToRemove) });
  };

  // Attachment Management
  const handleAttachFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Limit file size to 10MB to avoid local storage database bloat
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const newAttachment = {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: reader.result
      };
      const updatedAttachments = [...(card.attachments || []), newAttachment];
      onUpdate(card.id, { attachments: updatedAttachments });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = (attachIdx, e) => {
    e.stopPropagation();
    const updatedAttachments = (card.attachments || []).filter((_, idx) => idx !== attachIdx);
    onUpdate(card.id, { attachments: updatedAttachments });
  };

  const isCustomColor = card.color && card.color.startsWith('#');
  const currentThemeClass = isCustomColor ? '' : `card-theme-${card.color || 'slate'}`;
  const isImageCard = card.type === 'image';

  const customCardStyle = isCustomColor ? {
    borderColor: isSelected ? card.color : hexToRgba(card.color, 0.25),
    background: `linear-gradient(${hexToRgba(card.color, 0.05)}, ${hexToRgba(card.color, 0.05)}), rgba(18, 20, 24, 0.95)`,
    boxShadow: isSelected ? `0 0 20px ${hexToRgba(card.color, 0.35)}` : 'none',
  } : {};

  const notesStyle = {
    fontSize: card.notesFontSize === 'small' ? '12px' :
              card.notesFontSize === 'medium' ? '14px' :
              card.notesFontSize === 'large' ? '18px' :
              card.notesFontSize === 'xl' ? '24px' :
              card.notesFontSize ? card.notesFontSize : '14px',
    lineHeight: card.notesLineHeight || '1.4',
    color: card.notesTextColor === 'emerald' ? 'var(--accent-emerald)' :
           card.notesTextColor === 'cyan' ? 'var(--accent-cyan)' :
           card.notesTextColor === 'amber' ? 'var(--accent-amber)' :
           card.notesTextColor === 'rose' ? 'var(--accent-rose)' : 'rgba(255, 255, 255, 0.85)',
    fontFamily: card.notesFontFamily === 'serif' ? 'Georgia, serif' :
                card.notesFontFamily === 'mono' ? 'Courier New, Courier, monospace' : 'var(--font-body)',
    fontWeight: card.notesFontWeight || 'normal',
    fontStyle: card.notesFontStyle || 'normal',
    textDecoration: card.notesTextDecoration || 'none',
  };

  return (
    <div
      ref={cardRef}
      className={`card-wrapper ${currentThemeClass} ${isSelected ? 'selected' : ''} ${card.completed ? 'completed' : ''} ${isBlinking ? 'blinking' : ''}`}
      style={{
        transform: `translate(${card.x}px, ${card.y}px)`,
        width: card.width || 250,
        height: card.height || 200,
        ...customCardStyle,
      }}
      onMouseDown={handleMouseDown}
      onWheel={(e) => e.stopPropagation()}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (onDoubleClickFocus) onDoubleClickFocus(card);
      }}
    >
      <div className="card-content-container">
        {/* Card Header */}
        <div className="card-header">
          <div className="card-drag-handle" title={isViewOnly ? "Locked (View Only)" : "Drag header to move card"}>
            <GripHorizontal size={14} />
          </div>
          <input
            type="text"
            className="card-title-input"
            value={card.title}
            onChange={(e) => onUpdate(card.id, { title: e.target.value })}
            placeholder={isImageCard ? 'Image Note' : 'Untitled Note'}
            onClick={(e) => e.stopPropagation()}
            readOnly={isViewOnly}
          />
          <div className="card-actions-wrapper">
            {/* Tick Mark/Complete Button */}
            {!isViewOnly && (
              <button
                className={`card-action-btn checkmark-btn ${card.completed ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate(card.id, { completed: !card.completed });
                }}
                title={card.completed ? "Mark as Incomplete" : "Mark as Completed"}
              >
                <Check size={14} color={card.completed ? "var(--accent-emerald)" : "var(--color-text-muted)"} />
              </button>
            )}
            {/* Quick Connector Button */}
            {!isViewOnly && (
              <button
                className="card-action-btn"
                onMouseDown={handleQuickConnectMouseDown}
                title="Drag to Connect Card"
              >
                <Link2 size={14} color="var(--accent-cyan)" />
              </button>
            )}
            {!isViewOnly && (
              <button
                className="card-action-btn"
                onClick={() => setShowColorPicker(!showColorPicker)}
                title="Color Theme"
              >
                <Palette size={14} />
              </button>
            )}
            {!isViewOnly && (
              <button
                className="card-action-btn delete"
                onClick={() => onDelete(card.id)}
                title="Delete Card"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Floating Color Picker Overlay */}
        {showColorPicker && (
          <div className="card-color-picker-overlay" onClick={(e) => e.stopPropagation()}>
            {COLORS.map((col) => (
              <div
                key={col.name}
                className="color-dot"
                style={{ backgroundColor: col.value }}
                onClick={() => {
                  onUpdate(card.id, { color: col.name });
                  setShowColorPicker(false);
                }}
                title={col.name}
              />
            ))}
            <div style={{ width: '1px', height: '12px', background: 'rgba(255, 255, 255, 0.15)', margin: '0 4px' }} />
            {/* Custom Color Picker input */}
            <div className="color-picker-custom-wrapper" title="Custom color picker">
              <input
                type="color"
                value={isCustomColor ? card.color : '#6366f1'}
                onChange={(e) => onUpdate(card.id, { color: e.target.value })}
                className="color-dot-input"
              />
              <span className="color-picker-custom-icon">🎨</span>
            </div>
          </div>
        )}

        {/* Tab Headers (Notes vs Code vs Sketch vs Files) - For standard note cards */}
        {!isImageCard && (
          <div className="card-tabs-header">
            <button 
              className={`card-tab-btn ${activeMode === 'notes' ? 'active' : ''}`}
              onClick={() => {
                setLocalCardMode('notes');
                if (!isViewOnly) onUpdate(card.id, { cardMode: 'notes' });
              }}
            >
              <FileText size={10} style={{ marginRight: '2px', verticalAlign: 'middle' }} /> Notes
            </button>
            <button 
              className={`card-tab-btn ${activeMode === 'sketch' ? 'active' : ''}`}
              onClick={() => {
                setLocalCardMode('sketch');
                if (!isViewOnly) onUpdate(card.id, { cardMode: 'sketch' });
              }}
            >
              <Pencil size={10} style={{ marginRight: '2px', verticalAlign: 'middle' }} /> Sketch
            </button>
            <button 
              className={`card-tab-btn ${activeMode === 'attachments' ? 'active' : ''}`}
              onClick={() => {
                setLocalCardMode('attachments');
                if (!isViewOnly) onUpdate(card.id, { cardMode: 'attachments' });
              }}
            >
              <Paperclip size={10} style={{ marginRight: '2px', verticalAlign: 'middle' }} /> Files
            </button>
          </div>
        )}

        {/* Card Body Render according to selection */}
        {isImageCard ? (
          /* Render Image Card Content */
          <div className="card-image-content">
            <img src={card.imageUrl} alt={card.title || 'whiteboard asset'} />
          </div>
        ) : (
          /* Render Tab Content */
          <div className="card-body">
            {activeMode === 'notes' && (
              <>
                {/* Notes Customization Format Bar */}
                <div className="notes-format-bar" onClick={(e) => e.stopPropagation()} style={{ display: isViewOnly ? 'none' : 'flex' }}>
                  {/* Font Family Select */}
                  <select
                    className="format-select font-family-select"
                    value={card.notesFontFamily || 'sans'}
                    onChange={handleFontFamilyChange}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    title="Font Family"
                  >
                    <option value="sans">Sans-Serif</option>
                    <option value="serif">Serif</option>
                    <option value="mono">Monospace</option>
                  </select>

                  {/* Font Size Select */}
                  <select
                    className="format-select font-size-select"
                    value={card.notesFontSize || '14px'}
                    onChange={handleFontSizeChange}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    title="Font Size"
                  >
                    <option value="12px">12px</option>
                    <option value="13px">13px</option>
                    <option value="14px">14px</option>
                    <option value="15px">15px</option>
                    <option value="16px">16px</option>
                    <option value="18px">18px</option>
                    <option value="20px">20px</option>
                    <option value="22px">22px</option>
                    <option value="24px">24px</option>
                    <option value="28px">28px</option>
                    <option value="32px">32px</option>
                  </select>

                  {/* Text Color Select */}
                  <select
                    className="format-select text-color-select"
                    value={card.notesTextColor || 'default'}
                    onChange={handleTextColorChange}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    title="Text Color"
                    style={{
                      color: card.notesTextColor === 'emerald' ? 'var(--accent-emerald)' :
                             card.notesTextColor === 'cyan' ? 'var(--accent-cyan)' :
                             card.notesTextColor === 'amber' ? 'var(--accent-amber)' :
                             card.notesTextColor === 'rose' ? 'var(--accent-rose)' : 'white'
                    }}
                  >
                    <option value="default" style={{ color: 'white' }}>White</option>
                    <option value="cyan" style={{ color: 'var(--accent-cyan)' }}>Cyan</option>
                    <option value="emerald" style={{ color: 'var(--accent-emerald)' }}>Emerald</option>
                    <option value="amber" style={{ color: 'var(--accent-amber)' }}>Amber</option>
                    <option value="rose" style={{ color: 'var(--accent-rose)' }}>Rose</option>
                  </select>

                  <div className="format-divider" />

                  {/* Bold Toggle Button */}
                  <button
                    type="button"
                    className={`format-btn bold-btn ${card.notesFontWeight === 'bold' ? 'active' : ''}`}
                    onClick={handleBoldClick}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    title="Bold"
                    style={{ fontWeight: 'bold' }}
                  >
                    B
                  </button>

                  {/* Italic Toggle Button */}
                  <button
                    type="button"
                    className={`format-btn italic-btn ${card.notesFontStyle === 'italic' ? 'active' : ''}`}
                    onClick={handleItalicClick}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    title="Italic"
                    style={{ fontStyle: 'italic' }}
                  >
                    I
                  </button>

                  {/* Underline Toggle Button */}
                  <button
                    type="button"
                    className={`format-btn underline-btn ${card.notesTextDecoration === 'underline' ? 'active' : ''}`}
                    onClick={handleUnderlineClick}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    title="Underline"
                    style={{ textDecoration: 'underline' }}
                  >
                    U
                  </button>

                  {/* Container Card Button */}
                  <button
                    type="button"
                    className="format-btn container-btn"
                    onClick={handleContainerBoxClick}
                    onMouseDown={(e) => {
                      e.preventDefault();
                    }}
                    title="Wrap text in styled container card"
                  >
                    <Box size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </button>
                </div>

                <div
                  ref={editorRef}
                  contentEditable={!isViewOnly}
                  suppressContentEditableWarning
                  className="card-content-textarea"
                  style={{
                    ...notesStyle,
                    overflowY: 'auto',
                    cursor: 'text',
                    userSelect: 'text',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                  onInput={handleEditorInput}
                  onBlur={handleEditorInput}
                  onMouseUp={saveSelection}
                  onKeyUp={saveSelection}
                  placeholder="Write notes and concepts..."
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isViewOnly) return;
                    if (e.target.classList.contains('notes-callout-delete')) {
                      e.preventDefault();
                      const calloutBox = e.target.closest('.notes-callout-box');
                      if (calloutBox) {
                        calloutBox.remove();
                        handleEditorInput();
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (isViewOnly) return;
                    // Handle Backspace when inside an empty callout box
                    if (e.key === 'Backspace') {
                      const selection = window.getSelection();
                      if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        const callout = range.commonAncestorContainer.nodeType === 1
                          ? range.commonAncestorContainer.closest('.notes-callout-box')
                          : range.commonAncestorContainer.parentElement?.closest('.notes-callout-box');
                        
                        if (callout) {
                          const text = callout.textContent.replace('×', '').trim();
                          if (text === '') {
                            e.preventDefault();
                            const parent = callout.parentNode;
                            const textNode = document.createTextNode('');
                            parent.insertBefore(textNode, callout);
                            callout.remove();
                            
                            const newRange = document.createRange();
                            newRange.setStart(textNode, 0);
                            newRange.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(newRange);
                            
                            handleEditorInput();
                          }
                        }
                      }
                    }
                  }}
                />
                
                {/* Tags Area */}
                <div className="card-tags-area">
                  {card.tags.map((tag) => (
                    <span key={tag} className="tag-badge">
                      {tag}
                      {!isViewOnly && (
                        <span 
                          className="tag-badge-delete"
                          onClick={() => handleRemoveTag(tag)}
                          title="Remove Tag"
                        >
                          <X size={10} />
                        </span>
                      )}
                    </span>
                  ))}

                  {!isViewOnly && (
                    isEditingTag ? (
                      <form onSubmit={handleAddTag} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          className="tag-editor-input"
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onBlur={handleAddTag}
                          autoFocus
                          placeholder="Tag..."
                        />
                      </form>
                    ) : (
                      <button
                        className="tag-input-trigger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditingTag(true);
                          setNewTag('');
                        }}
                        title="Add Tag"
                      >
                        + tag
                      </button>
                    )
                  )}
                </div>
              </>
            )}

            {activeMode === 'attachments' && (
              <div className="card-attachments-section" onClick={(e) => e.stopPropagation()} style={{ borderTop: 'none', marginTop: '0', height: '100%', maxHeight: 'none' }}>
                <div className="card-attachments-header" style={{ marginBottom: '0.4rem' }}>
                  <span className="attachments-title">Attached Files</span>
                  {!isViewOnly && (
                    <label className="card-attach-label" title="Attach file (PDF, Image, Markdown, text)">
                      <Paperclip size={11} /> Add
                      <input 
                        type="file" 
                        onChange={handleAttachFile} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                  )}
                </div>
                
                <div className="card-attachments-list">
                  {(card.attachments || []).length === 0 ? (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '1.5rem 0' }}>
                      No attachments on this card.
                    </div>
                  ) : (
                    (card.attachments || []).map((att, idx) => {
                      const isImg = att.mimeType.startsWith('image/');
                      const isMd = att.name.endsWith('.md');
                      const isPdf = att.mimeType === 'application/pdf';

                      return (
                        <div key={idx} className="card-attachment-item">
                          <div className="attachment-item-info">
                            <span className="attachment-icon">
                              {isImg && <Image size={11} color="var(--accent-cyan)" />}
                              {isMd && <FileText size={11} color="var(--accent-amber)" />}
                              {isPdf && <FileText size={11} color="var(--accent-rose)" />}
                              {!isImg && !isMd && !isPdf && <Paperclip size={11} color="var(--color-text-muted)" />}
                            </span>
                            <span className="attachment-name" title={att.name}>{att.name}</span>
                            <span className="attachment-size">({(att.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          
                          <div className="attachment-item-actions">
                            <a 
                              href={att.dataUrl} 
                              download={att.name}
                              className="attachment-action-btn"
                              title="Download file"
                            >
                              <Download size={10} />
                            </a>
                            {!isViewOnly && (
                              <button 
                                type="button"
                                className="attachment-action-btn delete"
                                onClick={(e) => handleRemoveAttachment(idx, e)}
                                title="Remove attachment"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}



            {activeMode === 'sketch' && (
              <div className="card-sketch-container">
                <canvas
                  ref={canvasRef}
                  className="card-sketch-canvas"
                  onMouseDown={handleSketchMouseDown}
                  onMouseMove={handleSketchMouseMove}
                  onMouseUp={handleSketchMouseUpOrLeave}
                  onMouseLeave={handleSketchMouseUpOrLeave}
                />
                
                {/* Floating controls for internal sandbox canvas */}
                {!isViewOnly && (
                  <div className="card-sketch-toolbar">
                    <button 
                      className={`card-sketch-btn ${sketchTool === 'draw' ? 'active' : ''}`}
                      onClick={() => setSketchTool('draw')}
                      title="Pencil drawing"
                    >
                      <Pencil size={11} />
                    </button>
                    <button 
                      className={`card-sketch-btn ${sketchTool === 'erase' ? 'active' : ''}`}
                      onClick={() => setSketchTool('erase')}
                      title="Eraser tool"
                    >
                      <Eraser size={11} />
                    </button>
                    
                    <div style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.1)' }} />
                    
                    {/* Colors for sandbox canvas */}
                    {['#ffffff', '#f43f5e', '#10b981', '#6366f1'].map((c) => (
                      <div 
                        key={c}
                        className="color-dot"
                        style={{ 
                          backgroundColor: c, 
                          width: '10px', 
                          height: '10px', 
                          border: sketchColor === c ? '1px solid white' : 'none' 
                        }}
                        onClick={() => {
                          setSketchColor(c);
                          setSketchTool('draw');
                        }}
                      />
                    ))}
                    
                    <div style={{ width: '1px', height: '10px', background: 'rgba(255,255,255,0.1)' }} />
                    
                    <button 
                      className="card-sketch-btn"
                      onClick={handleClearSketch}
                      title="Clear Sketch drawing"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>



      {/* 8-Way Card Resize Handles */}
      {!isViewOnly && (
        <>
          <div className="resize-handle resize-handle-tl" onMouseDown={(e) => handleResizeMouseDown('tl', e)} />
          <div className="resize-handle resize-handle-tr" onMouseDown={(e) => handleResizeMouseDown('tr', e)} />
          <div className="resize-handle resize-handle-bl" onMouseDown={(e) => handleResizeMouseDown('bl', e)} />
          <div className="resize-handle resize-handle-br" onMouseDown={(e) => handleResizeMouseDown('br', e)} />
          <div className="resize-handle resize-handle-t" onMouseDown={(e) => handleResizeMouseDown('t', e)} />
          <div className="resize-handle resize-handle-r" onMouseDown={(e) => handleResizeMouseDown('r', e)} />
          <div className="resize-handle resize-handle-b" onMouseDown={(e) => handleResizeMouseDown('b', e)} />
          <div className="resize-handle resize-handle-l" onMouseDown={(e) => handleResizeMouseDown('l', e)} />
        </>
      )}

      {/* Connection nodes rendered in Select Mode */}
      {!isViewOnly && toolMode === 'select' && (
        <>
          <div 
            className="connection-node node-top" 
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConnection(card.id, 'top', e);
            }}
            title="Drag to connect"
          />
          <div 
            className="connection-node node-right" 
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConnection(card.id, 'right', e);
            }}
            title="Drag to connect"
          />
          <div 
            className="connection-node node-bottom" 
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConnection(card.id, 'bottom', e);
            }}
            title="Drag to connect"
          />
          <div 
            className="connection-node node-left" 
            onMouseDown={(e) => {
              e.stopPropagation();
              onStartConnection(card.id, 'left', e);
            }}
            title="Drag to connect"
          />
        </>
      )}
    </div>
  );
}

export default Card;
