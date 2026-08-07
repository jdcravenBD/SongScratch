import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Song } from '../types';
import { deleteSongs, getSong, putSong } from '../db/songs';
import { extractMeta, setBlockKind, type BlockKind } from '../lib/lyrics';
import { formatStamp } from '../lib/format';
import { newId } from '../lib/id';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { useVoiceMemos } from '../hooks/useVoiceMemos';
import { useChordSections } from '../hooks/useChordSections';
import { deleteMemosForSong } from '../db/memos';
import ScrollArea from './ScrollArea';
import LyricsTab from './LyricsTab';
import FormatBar from './FormatBar';
import { VoiceDock, VoiceList } from './VoiceTab';
import { ChordsDock, ChordsList } from './ChordsTab';
import ChordPicker from './ChordPicker';
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
  const voice = useVoiceMemos(id, tab === 'voice');
  const chords = useChordSections(id, tab === 'chords');

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
      const next: Song = {
        ...current,
        lyrics: html,
        title: meta.title,
        tuning: meta.tuning || current.tuning,
        description: meta.description,
        sectionCount: meta.sectionCount,
        updatedAt: Date.now(),
      };
      await putSong(next);
      // Keeps the "last edited" line honest while typing. Safe to re-render:
      // LyricsTab loads its document per song id, so this never rewrites the
      // element under the caret.
      setSong((prev) => (prev ? { ...prev, updatedAt: next.updatedAt } : prev));
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
    <>
    <div
      className={`screen editor${editing ? ' is-editing' : ''}${
        tab === 'voice' ? ' is-voice' : ''
      }${tab === 'chords' ? ' is-chords' : ''}`}
    >
      <header className="ebar">
        <button className="iconbtn" type="button" aria-label="Back to songs" onClick={onBack}>
          <BackIcon />
        </button>

        <div className="ebar__end">
          <div className="pillgroup">
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
        </div>
      </header>

      <ScrollArea dragScroll={!editing}>
        {tab === 'lyrics' ? (
          <>
            {/* Outside the editable document, so it can't be typed into. */}
            <p className="stamp">{formatStamp(song.updatedAt)}</p>
            <LyricsTab
              song={song}
              editing={editing}
              docRef={docRef}
              onRequestEdit={() => setEditing(true)}
              onInput={handleInput}
              onLeave={finishEditing}
            />
          </>
        ) : tab === 'voice' ? (
          <VoiceList voice={voice} />
        ) : (
          <ChordsList chords={chords} />
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
        /* Tabs along the bottom, within thumb reach. There is no edit button:
           editing starts by tapping the page where you want the caret. */
        <div className="edock">
          {tab === 'voice' && <VoiceDock voice={voice} />}
          {tab === 'chords' && <ChordsDock chords={chords} />}

          <nav className="tabs" aria-label="Song sections">
            {TABS.map((t) => (
              <button
                key={t}
                className={`tabs__tab${tab === t ? ' is-on' : ''}`}
                type="button"
                aria-current={tab === t}
                onClick={() => setTab(t)}
              >
                {TAB_LABEL[t]}
              </button>
            ))}
          </nav>
        </div>
      )}

      {menuOpen && (
        <div className="menu" role="dialog" aria-label="Song actions">
          <button
            className="menu__scrim"
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="menu__panel">
            <button
              className="menu__item"
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
              className="menu__item"
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
              className="menu__item menu__item--danger"
              type="button"
              onClick={async () => {
                // Drop the pending write first, or it would resurrect the song.
                window.clearTimeout(saveTimer.current);
                pending.current = null;
                // Recordings must not outlive the song they belong to.
                await deleteMemosForSong(song.id);
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

    {/* Picking a chord takes the whole screen — the fretboard needs the room,
        and search and the note wheel are still to join it there. */}
    {chords.addingTo && (
      <ChordPicker
        onCancel={chords.cancelAdd}
        onConfirm={(chord) => void chords.addChord(chords.addingTo!, chord)}
      />
    )}
    </>
  );
}
