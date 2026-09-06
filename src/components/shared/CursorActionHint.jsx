import React, { useState, useEffect, useRef } from 'react';

/**
 * CursorActionHint - Ultra Minimal Edition
 * - Supports resize handles (`.resize-handle`): Left: "Resize", Right: "No Action" (greyed out), suppresses menus.
 * - Fixes stale context menu state bug: live DOM checks ensure menu state ("Execute / No Action")
 *   clears instantly when context menu closes.
 * - Rest-on-Drag tracking: position locks while mouse button is held down.
 * - Micro SVG logos (11x14px) and light font weight (400).
 * - Scoped strictly to Canvas workspace; disables editing actions in View-Only mode.
 */
export default function CursorActionHint() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('dragg_cursor_hint_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });
  const [visible, setVisible] = useState(false);
  const [hintState, setHintState] = useState({
    leftLabel: 'Select',
    leftActive: true,
    leftDisabled: false,
    rightLabel: 'Menu',
    rightActive: true,
    rightDisabled: false,
    badgeText: ''
  });

  const wrapperRef = useRef(null);
  const targetPosRef = useRef({ x: -1000, y: -1000 });
  const currentPosRef = useRef({ x: -1000, y: -1000 });
  const mousePosRef = useRef({ x: -1000, y: -1000 });
  const isMouseDraggingRef = useRef(false);
  
  const cachedObstacleRef = useRef(null);
  const cachedRectRef = useRef(null);
  const dragStartOffsetRef = useRef(null);
  const lastRectCheckTimeRef = useRef(0);
  const initializedRef = useRef(false);

  // Toggle with 'h' or 'H' key (ignoring input/textarea elements)
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

      if (e.key === 'h' || e.key === 'H') {
        setEnabled((prev) => {
          const next = !prev;
          try {
            localStorage.setItem('dragg_cursor_hint_enabled', JSON.stringify(next));
          } catch (err) {}
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset cursor position tracking when enabled state toggles ON
  useEffect(() => {
    if (enabled) {
      initializedRef.current = false;
    } else {
      setVisible(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      if (visible) setVisible(false);
      return;
    }

    const handleMouseDown = (e) => {
      if (e.button === 0 || e.button === 2) {
        isMouseDraggingRef.current = true;
      }
    };

    const handleMouseUp = () => {
      isMouseDraggingRef.current = false;
    };

    window.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('mouseup', handleMouseUp, true);
    window.addEventListener('pointerdown', handleMouseDown, true);
    window.addEventListener('pointerup', handleMouseUp, true);

    const handleMouseMove = (e) => {
      if (e.buttons > 0) {
        isMouseDraggingRef.current = true;
      } else {
        isMouseDraggingRef.current = false;
      }

      const mouseX = e.clientX;
      const mouseY = e.clientY;
      mousePosRef.current = { x: mouseX, y: mouseY };

      const target = e.target || (mouseX > 0 && mouseY > 0 ? document.elementFromPoint(mouseX, mouseY) : null);
      if (!target) return;

      const isInsideCanvas = target.closest?.(
        '[data-canvas-root="true"], .canvas-container, .board-workspace-wrapper, .view-only-canvas, .system-design-canvas'
      );

      if (!isInsideCanvas) {
        if (visible) setVisible(false);
        return;
      }

      // Strip browser title tooltips inside canvas to ensure CursorActionHint is the single source of truth
      const titleEl = target.closest?.('[title]');
      if (titleEl && titleEl.getAttribute('title')) {
        titleEl.setAttribute('data-canvas-title', titleEl.getAttribute('title'));
        titleEl.removeAttribute('title');
      }

      if (!initializedRef.current) {
        currentPosRef.current = { x: mouseX, y: mouseY + 18 };
        targetPosRef.current = { x: mouseX, y: mouseY + 18 };
        if (wrapperRef.current) {
          wrapperRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY + 18}px, 0)`;
        }
        initializedRef.current = true;
        setVisible(true);
      } else if (!visible) {
        currentPosRef.current = { x: mouseX, y: mouseY + 18 };
        targetPosRef.current = { x: mouseX, y: mouseY + 18 };
        if (wrapperRef.current) {
          wrapperRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY + 18}px, 0)`;
        }
        setVisible(true);
      }

      const shiftPressed = e.shiftKey;
      const ctrlPressed = e.ctrlKey || e.metaKey;

      const isViewOnlyBoard = target.closest?.('[data-view-only="true"], .view-only-canvas') ||
        document.querySelector('[data-view-only="true"], .view-only-canvas');

      const isDraftConnecting = target.closest?.('[data-draft-connecting="true"]') ||
        document.querySelector('[data-draft-connecting="true"]');

      const rawMenuEl = target.closest?.('.context-menu-popover, .context-menu, .dev-tool-context-menu, .dropdown-menu, [role="menu"]');
      const menuEl = (rawMenuEl && document.body.contains(rawMenuEl)) ? rawMenuEl : null;

      const resizeEl = target.closest?.('.resize-handle, .resize-handle-se, [class*="resize-handle"]');
      const portEl = target.closest?.('.connection-node, .connector-port, .port-handle, .connection-port, [title*="connect"], [title*="Connect"], [data-canvas-title*="connect"], [data-canvas-title*="Connect"], .connector-dot, .port-dot');
      const dragGripEl = target.closest?.('.card-drag-handle, [title*="drag"], [title*="Drag"], [data-canvas-title*="drag"], [data-canvas-title*="Drag"]');
      const cardEl = target.closest?.('[data-card-id], .card-container, .card-node');
      const connEl = target.closest?.('[data-connection-id], .connection-line, .connection-path');
      const groupEl = target.closest?.('.group-container, [data-group-id]');
      const toolbarEl = target.closest?.('.vertical-toolbar-container, .left-vertical-toolbar, .toolbar-button, .sidebar-panel, .top-toolbar');
      const navbarEl = target.closest?.('.canvas-header, .sd-header-navbar, .board-navbar, .header-navbar');
      const buttonEl = target.closest?.('button, .button, input, select');

      const newObstacle = menuEl || navbarEl || toolbarEl || cardEl || groupEl || buttonEl || (portEl && portEl.closest?.('[data-card-id], .card-container, .card-node')) || (resizeEl && resizeEl.closest?.('[data-card-id], .card-container, .card-node, .group-container'));
      if (newObstacle !== cachedObstacleRef.current) {
        cachedObstacleRef.current = newObstacle;
        cachedRectRef.current = newObstacle ? newObstacle.getBoundingClientRect() : null;
        lastRectCheckTimeRef.current = performance.now();
      }

      let newHint = {
        leftLabel: 'Select',
        leftActive: true,
        leftDisabled: false,
        rightLabel: 'Menu',
        rightActive: true,
        rightDisabled: false,
        badgeText: shiftPressed ? 'Shift' : (ctrlPressed ? 'Ctrl' : '')
      };

      if (isViewOnlyBoard) {
        newHint = {
          leftLabel: 'Pan',
          leftActive: true,
          leftDisabled: false,
          rightLabel: 'View Only',
          rightActive: true,
          rightDisabled: true,
          badgeText: ''
        };
      } else if (isDraftConnecting) {
        newHint = {
          leftLabel: cardEl || portEl ? 'Connect Node' : 'Drop Connection',
          leftActive: true,
          leftDisabled: false,
          rightLabel: 'No Action',
          rightActive: true,
          rightDisabled: true,
          badgeText: ''
        };
      } else if (menuEl) {
        const tagInput = target.closest?.('input, [placeholder*="tag"], [class*="tag"]:not(.tag-delete-btn)');
        const tagRemoveBtn = target.closest?.('.tag-delete-btn, [class*="tag"] svg, [class*="remove"]');
        const dangerItem = target.closest?.('.danger, [class*="danger"], [class*="delete"]');
        const interactiveItem = target.closest?.('button, input, select, a, [role="button"], .context-menu-item, [onClick]');

        if (tagRemoveBtn) {
          newHint = {
            leftLabel: 'Delete ID',
            leftActive: true,
            leftDisabled: false,
            leftIsDanger: true,
            rightLabel: 'No Action',
            rightActive: true,
            rightDisabled: true,
            badgeText: ''
          };
        } else if (tagInput) {
          newHint = {
            leftLabel: 'Add ID',
            leftActive: true,
            leftDisabled: false,
            rightLabel: 'No Action',
            rightActive: true,
            rightDisabled: true,
            badgeText: ''
          };
        } else if (dangerItem) {
          newHint = {
            leftLabel: 'Delete Line',
            leftActive: true,
            leftDisabled: false,
            leftIsDanger: true,
            rightLabel: 'No Action',
            rightActive: true,
            rightDisabled: true,
            badgeText: ''
          };
        } else if (interactiveItem) {
          newHint = {
            leftLabel: 'Select Option',
            leftActive: true,
            leftDisabled: false,
            rightLabel: 'No Action',
            rightActive: true,
            rightDisabled: true,
            badgeText: ''
          };
        } else {
          // Hovering passive background/header padding inside context menu card
          newHint = {
            leftLabel: 'No Action',
            leftActive: true,
            leftDisabled: true,
            rightLabel: 'No Action',
            rightActive: true,
            rightDisabled: true,
            badgeText: ''
          };
        }
      } else if (resizeEl) {
        // Card/Group Resize Handle matched
        newHint = {
          leftLabel: 'Resize',
          leftActive: true,
          leftDisabled: false,
          rightLabel: 'No Action',
          rightActive: true,
          rightDisabled: true,
          badgeText: ''
        };
      } else if (portEl) {
        newHint = {
          leftLabel: 'Connect Line',
          leftActive: true,
          leftDisabled: false,
          rightLabel: 'No Action',
          rightActive: true,
          rightDisabled: true,
          badgeText: shiftPressed ? 'Shift' : ''
        };
      } else if (dragGripEl) {
        newHint = {
          leftLabel: 'Drag',
          leftActive: true,
          leftDisabled: false,
          rightLabel: 'Card Menu',
          rightActive: true,
          rightDisabled: false,
          badgeText: ''
        };
      } else if (cardEl) {
        newHint = {
          leftLabel: shiftPressed ? 'Add Select' : 'Select',
          leftActive: true,
          leftDisabled: false,
          rightLabel: 'Card Menu',
          rightActive: true,
          rightDisabled: false,
          badgeText: shiftPressed ? 'Shift' : ''
        };
      } else if (connEl) {
        newHint = {
          leftLabel: 'Double Tap Delete',
          leftActive: true,
          leftDisabled: false,
          leftIsDanger: true,
          rightLabel: 'Line Menu',
          rightActive: true,
          rightDisabled: false,
          badgeText: ''
        };
      } else if (groupEl) {
        newHint = {
          leftLabel: 'Move Group',
          leftActive: true,
          leftDisabled: false,
          rightLabel: 'Group Menu',
          rightActive: true,
          rightDisabled: false,
          badgeText: ''
        };
      } else if (toolbarEl) {
        newHint = {
          leftLabel: 'Select Tool',
          leftActive: true,
          leftDisabled: false,
          rightLabel: 'No Action',
          rightActive: true,
          rightDisabled: true,
          badgeText: ''
        };
      } else if (navbarEl) {
        newHint = {
          leftLabel: 'Select',
          leftActive: true,
          leftDisabled: false,
          rightLabel: 'No Action',
          rightActive: true,
          rightDisabled: true,
          badgeText: ''
        };
      } else {
        newHint = {
          leftLabel: shiftPressed ? 'Box Select' : 'Pan',
          leftActive: true,
          leftDisabled: false,
          rightLabel: 'Canvas Menu',
          rightActive: true,
          rightDisabled: false,
          badgeText: shiftPressed ? 'Shift' : ''
        };
      }

      setHintState((prev) => {
        if (
          prev.leftLabel === newHint.leftLabel &&
          prev.rightLabel === newHint.rightLabel &&
          prev.badgeText === newHint.badgeText &&
          prev.leftActive === newHint.leftActive &&
          prev.rightActive === newHint.rightActive &&
          prev.leftDisabled === newHint.leftDisabled &&
          prev.rightDisabled === newHint.rightDisabled &&
          prev.leftIsDanger === newHint.leftIsDanger &&
          prev.rightIsDanger === newHint.rightIsDanger &&
          prev.leftClickCount === newHint.leftClickCount &&
          prev.rightClickCount === newHint.rightClickCount
        ) {
          return prev;
        }
        return newHint;
      });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseover', handleMouseMove, { passive: true });

    // Trigger immediate evaluation if mouse position is already captured in window
    if (mousePosRef.current.x > 0 && mousePosRef.current.y > 0) {
      handleMouseMove({ clientX: mousePosRef.current.x, clientY: mousePosRef.current.y, buttons: 0, shiftKey: false, ctrlKey: false });
    }

    let animationFrameId;
    const updatePosition = () => {
      const mouseX = mousePosRef.current.x;
      const mouseY = mousePosRef.current.y;

      if (mouseX > -500 && mouseY > -500) {
        const badgeWidth = wrapperRef.current ? wrapperRef.current.offsetWidth || 85 : 85;
        const badgeHeight = wrapperRef.current ? wrapperRef.current.offsetHeight || 30 : 30;
        const GAP = 12;

        const obstacle = cachedObstacleRef.current;
        let finalTargetX = mouseX - badgeWidth / 2;
        let finalTargetY = mouseY + 18;

        if (isMouseDraggingRef.current) {
          // If dragging a card/obstacle, follow the obstacle's bounding rect offset locked at drag start
          if (obstacle && document.body.contains(obstacle)) {
            const currentRect = obstacle.getBoundingClientRect();
            if (!dragStartOffsetRef.current) {
              dragStartOffsetRef.current = {
                x: targetPosRef.current.x - currentRect.left,
                y: targetPosRef.current.y - currentRect.top
              };
            }
            finalTargetX = currentRect.left + dragStartOffsetRef.current.x;
            finalTargetY = currentRect.top + dragStartOffsetRef.current.y;
          }
        } else {
          dragStartOffsetRef.current = null;

          if (obstacle && document.body.contains(obstacle)) {
            const rect = obstacle.getBoundingClientRect();
            if (rect) {
              const distLeft = mouseX - rect.left;
              const distRight = rect.right - mouseX;
              const distTop = mouseY - rect.top;
              const distBottom = rect.bottom - mouseY;

              const minDist = Math.min(distLeft, distRight, distTop, distBottom);

              if (minDist === distTop) {
                finalTargetY = rect.top - badgeHeight - GAP;
                finalTargetX = Math.max(rect.left, Math.min(rect.right - badgeWidth, mouseX - badgeWidth / 2));
              } else if (minDist === distBottom) {
                finalTargetY = rect.bottom + GAP;
                finalTargetX = Math.max(rect.left, Math.min(rect.right - badgeWidth, mouseX - badgeWidth / 2));
              } else if (minDist === distLeft) {
                finalTargetX = rect.left - badgeWidth - GAP;
                finalTargetY = Math.max(rect.top, Math.min(rect.bottom - badgeHeight, mouseY - badgeHeight / 2));
              } else {
                finalTargetX = rect.right + GAP;
                finalTargetY = Math.max(rect.top, Math.min(rect.bottom - badgeHeight, mouseY - badgeHeight / 2));
              }
            }
          } else {
            cachedObstacleRef.current = null;
            cachedRectRef.current = null;
          }
        }

        // Clamp finalTargetX & finalTargetY inside viewport boundaries with a 12px safe margin
        const MARGIN = 12;
        const maxAllowedX = window.innerWidth - badgeWidth - MARGIN;
        const maxAllowedY = window.innerHeight - badgeHeight - MARGIN;

        finalTargetX = Math.max(MARGIN, Math.min(maxAllowedX, finalTargetX));
        finalTargetY = Math.max(MARGIN, Math.min(maxAllowedY, finalTargetY));

        targetPosRef.current = { x: finalTargetX, y: finalTargetY };
      }

      currentPosRef.current.x += (targetPosRef.current.x - currentPosRef.current.x) * 0.15;
      currentPosRef.current.y += (targetPosRef.current.y - currentPosRef.current.y) * 0.15;
      
      if (wrapperRef.current) {
        wrapperRef.current.style.transform = `translate3d(${currentPosRef.current.x}px, ${currentPosRef.current.y}px, 0)`;
      }

      animationFrameId = requestAnimationFrame(updatePosition);
    };

    animationFrameId = requestAnimationFrame(updatePosition);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
      window.removeEventListener('pointerdown', handleMouseDown, true);
      window.removeEventListener('pointerup', handleMouseUp, true);
      cancelAnimationFrame(animationFrameId);
    };
  }, [enabled, visible]);

  if (!enabled || !visible) return null;

  return (
    <div
      ref={wrapperRef}
      className="cursor-action-hint-wrapper"
      style={{
        transform: `translate3d(${currentPosRef.current.x}px, ${currentPosRef.current.y}px, 0)`,
      }}
    >
      <div className="cursor-action-hint-container">
        {/* Modifier Badge */}
        {hintState.badgeText && (
          <div className="cursor-hint-badge">
            {hintState.badgeText}
          </div>
        )}

        {/* Left Click Preview */}
        {hintState.leftActive && (
          <div className={`cursor-hint-item ${hintState.leftDisabled ? 'disabled' : ''} ${hintState.leftIsDanger ? 'is-danger' : ''}`}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              {(hintState.leftClickCount === 2 || hintState.leftLabel === 'Double Tap Delete') && (
                <>
                  <div className="double-tap-ripple-ring double-tap-ripple-ring-1" />
                  <div className="double-tap-ripple-ring double-tap-ripple-ring-2" />
                </>
              )}
              <svg
                className="cursor-mouse-svg"
                width="11"
                height="14"
                viewBox="0 0 24 30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect
                  x="2"
                  y="2"
                  width="20"
                  height="26"
                  rx="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                <line x1="12" y1="2" x2="12" y2="13" stroke="currentColor" strokeWidth="1.6" />
                <line x1="2" y1="13" x2="22" y2="13" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M 12 2.5 L 12 12.5 L 3 12.5 A 9 9 0 0 1 12 2.5 Z"
                  fill="currentColor"
                  className="cursor-mouse-fill-path"
                />
              </svg>
              {hintState.leftClickCount && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-6px',
                    background: 'transparent',
                    color: 'currentColor',
                    fontSize: '0.6rem',
                    fontWeight: 800,
                    lineHeight: 1
                  }}
                >
                  {hintState.leftClickCount}
                </span>
              )}
            </div>
            <span key={hintState.leftLabel} className="cursor-hint-label cursor-hint-label-fade">
              {hintState.leftLabel}
            </span>
          </div>
        )}

        {/* Right Click Preview */}
        {hintState.rightActive && (
          <div className={`cursor-hint-item ${hintState.rightDisabled ? 'disabled' : ''} ${hintState.rightIsDanger ? 'is-danger' : ''}`}>
            <svg
              className="cursor-mouse-svg"
              width="11"
              height="14"
              viewBox="0 0 24 30"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="2"
                y="2"
                width="20"
                height="26"
                rx="10"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
              />
              <line x1="12" y1="2" x2="12" y2="13" stroke="currentColor" strokeWidth="1.6" />
              <line x1="2" y1="13" x2="22" y2="13" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M 12 2.5 L 12 12.5 L 21 12.5 A 9 9 0 0 0 12 2.5 Z"
                fill="currentColor"
                className="cursor-mouse-fill-path"
              />
            </svg>
            <span key={hintState.rightLabel} className="cursor-hint-label cursor-hint-label-fade">
              {hintState.rightLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
