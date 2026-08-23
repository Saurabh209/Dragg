import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent, Extension } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Underline as TipTapUnderline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { Subscript as TipTapSubscript } from '@tiptap/extension-subscript';
import { Superscript as TipTapSuperscript } from '@tiptap/extension-superscript';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Palette,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Code,
  Quote,
  Minus,
  Type
} from 'lucide-react';

const lowlight = createLowlight(common);

const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize: fontSize => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .run();
      },
    };
  },
});

const PRESET_FONT_SIZES = [
  { label: 'Auto', value: '' },
  { label: '12px', value: '12px' },
  { label: '14px', value: '14px' },
  { label: '16px', value: '16px' },
  { label: '18px', value: '18px' },
  { label: '22px', value: '22px' },
  { label: '28px', value: '28px' }
];

const PRESET_TEXT_COLORS = [
  { name: 'Default', value: '' },
  { name: 'White', value: '#ffffff' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Blue', value: '#3b82f6' }
];

const RichTextEditor = ({
  content,
  onUpdate,
  isViewOnly = false,
  notesStyle = {}
}) => {
  const isUpdatingFromProps = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      TextStyle,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      TipTapUnderline,
      TipTapSubscript,
      TipTapSuperscript,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: content || '',
    editable: !isViewOnly,
    onUpdate: ({ editor }) => {
      if (isUpdatingFromProps.current) return;
      const html = editor.getHTML();
      onUpdate(html);
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!isViewOnly);
    }
  }, [editor, isViewOnly]);

  useEffect(() => {
    if (editor && content !== undefined) {
      const currentHTML = editor.getHTML();
      if (currentHTML !== content && !editor.isFocused) {
        isUpdatingFromProps.current = true;
        editor.commands.setContent(content || '', false);
        isUpdatingFromProps.current = false;
      }
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className="tiptap-editor-wrapper"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {!isViewOnly && (
        <div
          className="notes-format-bar tiptap-toolbar single-line-toolbar no-scrollbar"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="tiptap-font-size-wrapper" title="Font Size">
            <Type size={11} className="font-size-icon" />
            <select
              className="format-select font-size-select"
              value={editor.getAttributes('textStyle').fontSize || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  editor.chain().focus().setFontSize(val).run();
                } else {
                  editor.chain().focus().unsetFontSize().run();
                }
              }}
            >
              {PRESET_FONT_SIZES.map((fs) => (
                <option key={fs.label} value={fs.value} style={{ background: '#181824', color: '#fff' }}>
                  {fs.label}
                </option>
              ))}
            </select>
          </div>

          <div className="format-divider" />
          <button
            type="button"
            className={`format-btn ${editor.isActive('bold') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (Ctrl+B)"
          >
            <Bold size={11} />
          </button>

          <button
            type="button"
            className={`format-btn ${editor.isActive('italic') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (Ctrl+I)"
          >
            <Italic size={11} />
          </button>

          <button
            type="button"
            className={`format-btn ${editor.isActive('underline') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon size={11} />
          </button>

          <button
            type="button"
            className={`format-btn ${editor.isActive('strike') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            <Strikethrough size={11} />
          </button>

          <div className="format-divider" />

          <button
            type="button"
            className={`format-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Align Left"
          >
            <AlignLeft size={11} />
          </button>
          <button
            type="button"
            className={`format-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Align Center"
          >
            <AlignCenter size={11} />
          </button>
          <button
            type="button"
            className={`format-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Align Right"
          >
            <AlignRight size={11} />
          </button>
          <button
            type="button"
            className={`format-btn ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            title="Justify Text"
          >
            <AlignJustify size={11} />
          </button>

          <div className="format-divider" />

          <button
            type="button"
            className={`format-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            <Heading1 size={11} />
          </button>
          <button
            type="button"
            className={`format-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            <Heading2 size={11} />
          </button>
          <button
            type="button"
            className={`format-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            <Heading3 size={11} />
          </button>

          <div className="format-divider" />

          <button
            type="button"
            className={`format-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="Bullet List (•)"
          >
            <List size={11} />
          </button>
          <button
            type="button"
            className={`format-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Numbered List (1.)"
          >
            <ListOrdered size={11} />
          </button>

          <div className="format-divider" />

          <button
            type="button"
            className={`format-btn ${editor.isActive('subscript') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleSubscript().run()}
            title="Subscript (X₂)"
          >
            <SubscriptIcon size={11} />
          </button>
          <button
            type="button"
            className={`format-btn ${editor.isActive('superscript') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
            title="Superscript (X²)"
          >
            <SuperscriptIcon size={11} />
          </button>

          <div className="format-divider" />

          <button
            type="button"
            className={`format-btn ${editor.isActive('codeBlock') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code Block"
          >
            <Code size={11} />
          </button>
          <button
            type="button"
            className={`format-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Blockquote"
          >
            <Quote size={11} />
          </button>

          <button
            type="button"
            className="format-btn"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Insert Horizontal Divider Line"
          >
            <Minus size={11} />
          </button>

          <div className="format-divider" />

          <button
            type="button"
            className={`format-btn ${editor.isActive('highlight') ? 'active' : ''}`}
            onClick={() => editor.chain().focus().toggleHighlight({ color: '#f59e0b55' }).run()}
            title="Highlight Text"
          >
            <Highlighter size={11} />
          </button>

          <div className="tiptap-color-swatches" title="Text Color">
            <Palette size={12} className="color-swatch-icon" />
            <div className="color-swatch-list">
              {PRESET_TEXT_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`color-swatch-dot ${editor.getAttributes('textStyle').color === c.value ? 'active' : ''}`}
                  style={{ backgroundColor: c.value || '#ffffff' }}
                  onClick={() => {
                    if (c.value) {
                      editor.chain().focus().setColor(c.value).run();
                    } else {
                      editor.chain().focus().unsetColor().run();
                    }
                  }}
                  title={`Color: ${c.name}`}
                />
              ))}
            </div>
            <input
              type="color"
              className="tiptap-color-input"
              value={editor.getAttributes('textStyle').color || '#ffffff'}
              onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
              title="Custom Color"
            />
          </div>

          <div className="format-divider" />

          <button
            type="button"
            className="format-btn"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo (Ctrl+Z)"
          >
            <Undo size={12} />
          </button>
          <button
            type="button"
            className="format-btn"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo (Ctrl+Y)"
          >
            <Redo size={12} />
          </button>
        </div>
      )}

      <EditorContent
        editor={editor}
        className="card-content-textarea tiptap-content-area"
        style={notesStyle}
      />
    </div>
  );
};

export default RichTextEditor;
