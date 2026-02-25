'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Bold, Heading1, Heading2, Code, Type, List, ListOrdered, Minus } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const btnCls =
  'p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground';
const btnActiveCls =
  'p-1.5 rounded bg-amber-500/20 text-amber-400';

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceValue, setSourceValue] = useState(value);
  const initializedRef = useRef(false);

  // Set initial content once
  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = value || '';
      initializedRef.current = true;
    }
  }, [value]);

  const exec = useCallback((cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    // Notify parent of change
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  function handleToggleSource() {
    if (sourceMode) {
      // Switch from source → visual
      if (editorRef.current) {
        editorRef.current.innerHTML = sourceValue;
        onChange(sourceValue);
      }
    } else {
      // Switch from visual → source
      if (editorRef.current) {
        setSourceValue(editorRef.current.innerHTML);
      }
    }
    setSourceMode(!sourceMode);
  }

  function handleInput() {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }

  function handleSourceChange(val: string) {
    setSourceValue(val);
    onChange(val);
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 flex-wrap">
        <button
          type="button"
          onClick={() => exec('bold')}
          className={btnCls}
          title="Bold"
          disabled={sourceMode}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', 'h1')}
          className={btnCls}
          title="Heading 1"
          disabled={sourceMode}
        >
          <Heading1 size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', 'h2')}
          className={btnCls}
          title="Heading 2"
          disabled={sourceMode}
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec('formatBlock', 'p')}
          className={btnCls}
          title="Paragraph"
          disabled={sourceMode}
        >
          <Type size={16} />
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button
          type="button"
          onClick={() => exec('insertUnorderedList')}
          className={btnCls}
          title="Bullet List"
          disabled={sourceMode}
        >
          <List size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec('insertOrderedList')}
          className={btnCls}
          title="Numbered List"
          disabled={sourceMode}
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          onClick={() => exec('insertHorizontalRule')}
          className={btnCls}
          title="Horizontal Rule"
          disabled={sourceMode}
        >
          <Minus size={16} />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleToggleSource}
          className={sourceMode ? btnActiveCls : btnCls}
          title={sourceMode ? 'Visual Mode' : 'HTML Source'}
        >
          <Code size={16} />
        </button>
      </div>

      {/* Editor area */}
      {sourceMode ? (
        <textarea
          value={sourceValue}
          onChange={(e) => handleSourceChange(e.target.value)}
          className="w-full min-h-[250px] p-4 bg-card text-foreground font-mono text-sm resize-y focus:outline-none"
          placeholder="<p>Enter HTML here...</p>"
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          data-placeholder={placeholder || 'Start writing...'}
          className="w-full min-h-[250px] p-4 text-foreground text-sm focus:outline-none prose prose-sm prose-invert max-w-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:pointer-events-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5 [&_hr]:border-border [&_hr]:my-3"
        />
      )}
    </div>
  );
}
