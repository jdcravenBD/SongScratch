import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Song } from '../types';
import { deleteSongs, getSong, putSong } from '../db/songs';
import { extractMeta, setBlockKind, type BlockKind } from '../lib/lyrics';
import { newId } from '../lib/id';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import ScrollArea from './ScrollArea';
import LyricsTab from './LyricsTab';
import FormatBar from './FormatBar';
import {
  BackIcon,
  DuplicateIcon,
  EllipsisIcon,
  PinIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
} from './icons';

const TABS = ['chords', 'lyrics', 'voice'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  chords: 'Chords',
  lyrics: 'Lyrics',
  voice: 'Voice',
};

/** Typing settles for this long before anything is written to the store. */
const SAVE_AFTER = 400;

interface Props {
  id: string;
  onBack: () => void;
}

/**
 * One song, opened. The three tabs are all views onto the same record — this
 * shell owns the chrome they share (back, undo/redo, the ellipsis menu, the tab
 * switcher) and whether the page is being edited, since that decides between
 * the Edit button and the format bar at the bottom.
 */
export default function SongEditor({ id, onBack }: Props) {
  const [song, setSong] = useState<Song | null>(null);
  // Lyrics is the tab that exists; chords and voice come next.
  const [tab, setTab] = useState<Tab>('lyrics');
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const docRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef(0);
  /** Latest unsaved HTML, so leaving the screen can flush it. */
  const pending = useRef<string | null>(null);
  const keyboardInset = useKeyboardInset();

  useEffect(() => {
    let alive = true;
    void getSong(id).then((s) => {
      if (alive && s) setSong(s);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  /** Writes the document, mirroring out what the song list draws. */
  const commit = useCallback(
    async (html: string) => {
      const current = await getSong(id);
      if (!current) return;
      const meta = extractMeta(html);
      await putSong({
        ...current,
        lyrics: html,
        title: meta.title,
        tuning: meta.tuning || current.tuning,
        description: meta.description,
        sectionCount: meta.sectionCount,
        updatedAt: Date.now(),
      });
    },
    [id],
  );

  const handleInput = useCallback(
    (html: string) => {
      pending.current = html;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        const next = pending.current;
        pending.current = null;
        if (next != null) void commit(next);
      }, SAVE_AFTER);
    },
    [commit],
  );

  // Never leave an edit behind on the way out.
  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      if (pending.current != null) void commit(pending.current);
    },
    [commit],
  );

  const finishEditing = () => {
    setEditing(false);
    docRef.current?.blur();
    const html = docRef.current?.innerHTML;
    if (html != null) {
      window.clearTimeout(saveTimer.current);
      pending.current = null;
      void commit(html);
    }
  };

  /** Keeps the caret alive across a toolbar press. */
  const keep = (e: MouseEvent) => e.preventDefault();

  const patch = async (changes: Partial<Song>) => {
    const current = await getSong(id);
    if (!current) return;
    const next = { ...current, ...changes };
    await putSong(next);
    setSong(next);
  };

  if (!song) return <div className="screen" />;

  return (
    <div className={`screen editor${editing ? ' is-editing' : ''}`}>
      <header className="ebar">
        <button className="iconbtn" type="button" aria-label="Back to songs" onClick={onBack}>
          <BackIcon />
        </button>

        <div className="ebar__mid">
          <button
            className="iconbtn"
            type="button"
            aria-label="Undo"
            disabled={!editing}
            onMouseDown={keep}
            onClick={() => document.execCommand('undo')}
          >
            <UndoIcon />
          </button>
          <button
            className="iconbtn"
            type="button"
            aria-label="Redo"
            disabled={!editing}
            onMouseDown={keep}
            onClick={() => document.execCommand('redo')}
          >
            <RedoIcon />
          </button>
        </div>

        <button
          className="iconbtn"
          type="button"
          aria-label="More actions"
          onClick={() => setMenuOpen(true)}
        >
          <EllipsisIcon />
        </button>
      </header>

      <nav className="tabs" aria-label="Song sections">
        {TABS.map((t) => (
          <button
            key={t}
            className={`tabs__tab${tab === t ? ' is-on' : ''}`}
            type="button"
            aria-current={tab === t}
            onClick={() => {
              if (editing) finishEditing();
              setTab(t);
            }}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      <ScrollArea dragScroll={!editing}>
        {tab === 'lyrics' ? (
          <LyricsTab
            song={song}
            editing={editing}
            docRef={docRef}
            onRequestEdit={() => setEditing(true)}
            onInput={handleInput}
            onLeave={finishEditing}
          />
        ) : (
          <div className="empty">
            <p className="empty__title">{TAB_LABEL[tab]}</p>
            <p className="empty__hint">This tab is next on the list.</p>
          </div>
        )}
      </ScrollArea>

      {editing ? (
        <FormatBar
          keyboardInset={keyboardInset}
          onBlockKind={(kind: BlockKind) => {
            const el = docRef.current;
            if (el) {
              setBlockKind(el, kind);
              handleInput(el.innerHTML);
            }
          }}
          onDone={finishEditing}
        />
      ) : (
        <div className="dock dock--editor">
          {tab === 'lyrics' && (
            <button className="chip chip--wide" type="button" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      )}

      {menuOpen && (
        <div className="sheet" role="dialog" aria-label="Song actions">
          <button
            className="sheet__scrim"
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="sheet__panel">
            <button
              className="sheet__item"
              type="button"
              onClick={async () => {
                await patch({ pinned: !song.pinned });
                setMenuOpen(false);
              }}
            >
              <PinIcon />
              <span>{song.pinned ? 'Unpin Song' : 'Pin Song'}</span>
            </button>
            <button
              className="sheet__item"
              type="button"
              onClick={async () => {
                const now = Date.now();
                await putSong({
                  ...song,
                  id: newId(),
                  title: song.title ? `${song.title} copy` : '',
                  pinned: false,
                  createdAt: now,
                  updatedAt: now,
                });
                setMenuOpen(false);
                onBack();
              }}
            >
              <DuplicateIcon />
              <span>Duplicate Song</span>
            </button>
            <button
              className="sheet__item sheet__item--danger"
              type="button"
              onClick={async () => {
                // Drop the pending write first, or it would resurrect the song.
                window.clearTimeout(saveTimer.current);
                pending.current = null;
                await deleteSongs([song.id]);
                setMenuOpen(false);
                onBack();
              }}
            >
              <TrashIcon />
              <span>Delete Song</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
