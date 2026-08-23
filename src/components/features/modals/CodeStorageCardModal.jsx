import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Save, FileCode } from 'lucide-react';

export default function CodeStorageCardModal({ isOpen, onClose, card, onSaveCode }) {
  if (!isOpen || !card) return null;

  const [code, setCode] = useState(card.code || card.content || '');
  const [title, setTitle] = useState(card.title || 'Code Snippet');
  const [language, setLanguage] = useState(card.language || 'javascript');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (card) {
      setCode(card.code || card.content || '');
      setTitle(card.title || 'Code Snippet');
      setLanguage(card.language || 'javascript');
    }
  }, [card]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSaveCode(card.id, {
      title,
      code,
      language
    });
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '720px',
          maxWidth: '90vw',
          height: '75vh',
          background: '#0f172a',
          borderRadius: '18px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 24px',
            background: '#1e293b',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <FileCode size={20} color="#6366f1" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Snippet Title..."
              style={{
                background: 'transparent',
                border: 'none',
                color: '#f8fafc',
                fontSize: '1.1rem',
                fontWeight: 700,
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                background: '#0f172a',
                color: '#94a3b8',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="javascript">JavaScript / JSX</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="json">JSON</option>
              <option value="html">HTML / CSS</option>
              <option value="bash">Bash / Shell</option>
              <option value="sql">SQL</option>
            </select>

            <button
              onClick={handleCopy}
              style={{
                background: copied ? '#10b981' : 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '4px',
                borderRadius: '6px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '16px', background: '#090d16', overflow: 'hidden' }}>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="// Paste or write code snippet here..."
            spellCheck={false}
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              fontFamily: 'Consolas, Monaco, "Fira Code", monospace',
              fontSize: '0.9rem',
              lineHeight: '1.6',
              outline: 'none',
              resize: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div
          style={{
            padding: '12px 24px',
            background: '#1e293b',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            {code.split('\n').length} lines • {code.length} characters
          </span>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#94a3b8',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Close
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#6366f1',
                color: '#ffffff',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Save size={14} /> Save Snippet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
