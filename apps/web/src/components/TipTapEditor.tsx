'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import { useCallback, useEffect, useState } from 'react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Table as TableIcon,
  Code,
  Undo,
  Redo,
  Maximize,
  Minimize,
  Heading1,
  Heading2,
  Heading3,
  Palette,
  Highlighter,
  Unlink,
  TableProperties,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface TipTapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active
          ? 'bg-amber-500/20 text-amber-400'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-1" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);

  const colors = [
    '#000000', '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#ffffff',
  ];

  const addLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  const addImage = useCallback(() => {
    const url = prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-border bg-muted/30">
      {/* Undo/Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Headings */}
      <ToolbarButton
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        title="Heading 1"
      >
        <Heading1 size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        title="Heading 2"
      >
        <Heading2 size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        title="Heading 3"
      >
        <Heading3 size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Inline formatting */}
      <ToolbarButton
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <Bold size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <Italic size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <UnderlineIcon size={16} />
      </ToolbarButton>

      {/* Text Color */}
      <div className="relative">
        <ToolbarButton
          onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); }}
          title="Text Color"
        >
          <Palette size={16} />
        </ToolbarButton>
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-card border border-border rounded-lg shadow-lg z-50 grid grid-cols-5 gap-1">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => { editor.chain().focus().setColor(c).run(); setShowColorPicker(false); }}
                className="w-6 h-6 rounded border border-border"
                style={{ backgroundColor: c }}
              />
            ))}
            <button
              onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
              className="col-span-5 text-xs text-muted-foreground hover:text-foreground py-1"
            >
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Highlight */}
      <div className="relative">
        <ToolbarButton
          active={editor.isActive('highlight')}
          onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); }}
          title="Highlight"
        >
          <Highlighter size={16} />
        </ToolbarButton>
        {showHighlightPicker && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-card border border-border rounded-lg shadow-lg z-50 grid grid-cols-5 gap-1">
            {['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff'].map((c) => (
              <button
                key={c}
                onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setShowHighlightPicker(false); }}
                className="w-6 h-6 rounded border border-border"
                style={{ backgroundColor: c }}
              />
            ))}
            <button
              onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlightPicker(false); }}
              className="col-span-5 text-xs text-muted-foreground hover:text-foreground py-1"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      <ToolbarDivider />

      {/* Text Align */}
      <ToolbarButton
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        title="Align Left"
      >
        <AlignLeft size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        title="Align Center"
      >
        <AlignCenter size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        title="Align Right"
      >
        <AlignRight size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: 'justify' })}
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        title="Justify"
      >
        <AlignJustify size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Lists */}
      <ToolbarButton
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet List"
      >
        <List size={16} />
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered List"
      >
        <ListOrdered size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Table */}
      <ToolbarButton onClick={insertTable} title="Insert Table">
        <TableIcon size={16} />
      </ToolbarButton>
      {editor.isActive('table') && (
        <>
          <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column">
            <TableProperties size={16} />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row">
            <TableProperties size={16} className="rotate-90" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
            <Trash2 size={16} />
          </ToolbarButton>
        </>
      )}

      <ToolbarDivider />

      {/* Link */}
      <ToolbarButton active={editor.isActive('link')} onClick={addLink} title="Insert Link">
        <LinkIcon size={16} />
      </ToolbarButton>
      {editor.isActive('link') && (
        <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} title="Remove Link">
          <Unlink size={16} />
        </ToolbarButton>
      )}

      {/* Image */}
      <ToolbarButton onClick={addImage} title="Insert Image">
        <ImageIcon size={16} />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Code */}
      <ToolbarButton
        active={editor.isActive('codeBlock')}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code Block"
      >
        <Code size={16} />
      </ToolbarButton>
    </div>
  );
}

export default function TipTapEditor({ value, onChange, placeholder }: TipTapEditorProps) {
  const [showSource, setShowSource] = useState(false);
  const [sourceHtml, setSourceHtml] = useState(value);
  const [fullscreen, setFullscreen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: placeholder ?? 'Write product description...' }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      onChange(html);
      setSourceHtml(html);
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm prose-invert max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleSourceSave = useCallback(() => {
    if (editor) {
      editor.commands.setContent(sourceHtml, { emitUpdate: false });
      onChange(sourceHtml);
      setShowSource(false);
    }
  }, [editor, sourceHtml, onChange]);

  if (!editor) return null;

  const wrapperClass = fullscreen
    ? 'fixed inset-0 z-50 bg-card flex flex-col'
    : 'border border-border rounded-xl overflow-hidden bg-card';

  return (
    <div className={wrapperClass}>
      <div className="flex items-center justify-between border-b border-border">
        <Toolbar editor={editor} />
        <div className="flex items-center gap-1 px-2">
          <ToolbarButton
            active={showSource}
            onClick={() => {
              if (!showSource) setSourceHtml(editor.getHTML());
              setShowSource(!showSource);
            }}
            title="HTML Source"
          >
            <Code size={16} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setFullscreen(!fullscreen)}
            title={fullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </ToolbarButton>
        </div>
      </div>

      {showSource ? (
        <div className="flex-1 flex flex-col">
          <textarea
            value={sourceHtml}
            onChange={(e) => setSourceHtml(e.target.value)}
            className="flex-1 bg-zinc-900 text-green-400 font-mono text-sm p-4 resize-none focus:outline-none"
            style={{ minHeight: fullscreen ? undefined : 200 }}
          />
          <div className="flex justify-end gap-2 p-2 border-t border-border">
            <button
              onClick={() => setShowSource(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleSourceSave}
              className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
            >
              Apply HTML
            </button>
          </div>
        </div>
      ) : (
        <div className={cn('overflow-auto', fullscreen ? 'flex-1' : '')}>
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );
}
