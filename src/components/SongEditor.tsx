import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import type { Song } from '../types';
import { deleteSongs, getSong, putSong } from '../db/songs';
import {
  blankDoc,
  extractMeta,
  isBlankDoc,
  markBlanks,
  setBlockKind,
  type BlockKind,
} from '../lib/lyrics';
import { newId } from '../lib/id';
import { useEdgeBack } from '../hooks/useEdgeBack';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { useVoiceMemos } from '../hooks/useVoiceMemos';
import { useChordSections } from '../hooks/useChordSections';
import ScrollArea from './ScrollArea';
import LyricsTab from './LyricsTab';
import FormatBar from './FormatBar';
import { VoiceDock, VoiceList } from './VoiceTab';
import { ChordsDock, ChordsList } from './ChordsTab';
import ChordMenu from './ChordMenu';
import ChordPicker from './ChordPicker';
import {
  BackIcon,
  DuplicateIcon,
  EllipsisIcon,
  PinIcon,
  RedoIcon,
  SelectIcon,
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

/** Matches --screen-ms, and App's own copy of it. */
const SCREEN_MS = 280;

interface Props {
  id: string;
  /** True while this screen is sliding back off to the right. */
  leaving?: boolean;
  /** Changes when something outside the editor has changed this song. */
  refreshKey?: number;
  onBack: () => void;
  /** Leave without the animation — for the edge swipe, which is its own. */
  onDismiss?: () => void;
  /** Opens Recently Deleted for whichever tab asked for it. */
  onTrash: (kind: 'sections' | 'memos') => void;
}

/**
 * One song, opened. The three tabs are all views onto the same record — this
 * shell owns the chrome they share (back, undo/redo, the ellipsis menu, the tab
 * switcher) and whether the page is being edited, since that decides between
 * the Edit button and the format bar at the bottom.
 */
export default function SongEditor({
  id,
  leaving,
  refreshKey,
  onBack,
  onDismiss,
  onTrash,
}: Props) {
  const [song, setSong] = useState<Song | null>(null);
  // Lyrics is the tab a song opens on.
  const [tab, setTab] = useState<Tab>('lyrics');
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  /** The picker, held on screen while it slides away. */
  const [pickerLeaving, setPickerLeaving] = useState(false);
  /**
   * Which way the tab being shown lies from the one before it. A ref, not
   * state: it is read while rendering the tab that changing it caused.
   */
  const tabDir = useRef(1);
  const pickerTimer = useRef(0);

  const docRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef(0);
  const titleTimer = useRef(0);
  /** Latest unsaved HTML, so leaving the screen can flush it. */
  const pending = useRef<string | null>(null);
  /** Same for the title, which saves on its own. */
  const pendingTitle = useRef<string | null>(null);
  const keyboardInset = useKeyboardInset();
  const voice = useVoiceMemos(id, tab === 'voice', refreshKey);
  const chords = useChordSections(id, tab === 'chords', refreshKey);

  // Swipe in from the left edge to leave, as the system apps do. Not while the
  // page is being written on, where a drag has to mean "select".
  const screenRef = useEdgeBack(onDismiss ?? onBack, !editing);

  useEffect(() => () => window.clearTimeout(pickerTimer.current), []);

  /** Sends the picker away, and does the thing it was closed for as it goes. */
  const closePicker = (act: () => void) => {
    if (pickerLeaving) return;
    setPickerLeaving(true);
    pickerTimer.current = window.setTimeout(() => {
      setPickerLeaving(false);
      act();
    }, SCREEN_MS);
  };

  /** Tabs arrive from whichever side they sit on relative to the last one. */
  const goTab = (next: Tab) => {
    tabDir.current = TABS.indexOf(next) - TABS.indexOf(tab);
    setTab(next);
  };

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

  /**
   * The title, on its own timer. It is a field on the song rather than part of
   * the page, so it never goes through the document's save at all.
   */
  const commitTitle = useCallback(
    async (title: string) => {
      const current = await getSong(id);
      if (!current) return;
      await putSong({ ...current, title, updatedAt: Date.now() });
      setSong((prev) => (prev ? { ...prev, title } : prev));
    },
    [id],
  );

  const handleTitle = useCallback(
    (title: string) => {
      pendingTitle.current = title;
      window.clearTimeout(titleTimer.current);
      titleTimer.current = window.setTimeout(() => {
        const next = pendingTitle.current;
        pendingTitle.current = null;
        if (next != null) void commitTitle(next);
      }, SAVE_AFTER);
    },
    [commitTitle],
  );

  // Never leave an edit behind on the way out.
  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      window.clearTimeout(titleTimer.current);
      if (pending.current != null) void commit(pending.current);
      if (pendingTitle.current != null) void commitTitle(pendingTitle.current);
    },
    [commit, commitTitle],
  );

  const finishEditing = () => {
    setEditing(false);
    const el = docRef.current;
    el?.blur();
    if (!el) return;
    // Everything gone: put the empty sheet back, ghost line and all, rather
    // than leaving a page with nothing on it and no way to tell it apart from
    // one that failed to load. Only on the way out — rebuilding the document
    // mid-sentence would take the caret and the undo stack with it.
    if (isBlankDoc(el)) el.innerHTML = blankDoc();
    markBlanks(el);
    window.clearTimeout(saveTimer.current);
    pending.current = null;
    void commit(el.innerHTML);
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
      ref={screenRef}
      className={`screen editor${leaving ? ' is-leaving' : ''}${
        editing ? ' is-editing' : ''
      }${tab === 'voice' ? ' is-voice' : ''}${tab === 'chords' ? ' is-chords' : ''}`}
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

      {/* Keyed by tab so the content is rebuilt — and so its entrance runs
          again — every time one is chosen. */}
      <ScrollArea
        key={tab}
        className={tabDir.current < 0 ? 'is-from-left' : 'is-from-right'}
        dragScroll={!editing}
      >
        {tab === 'lyrics' ? (
          <>
            <LyricsTab
              song={song}
              editing={editing}
              docRef={docRef}
              onRequestEdit={() => setEditing(true)}
              onInput={handleInput}
              onTitle={handleTitle}
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
                onClick={() => goTab(t)}
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
            {/* What the menu leads with depends on which tab is showing: it
                acts on the tab, not on the song. Each one is "Select" — the
                lists enter the same picking mode the song list has, and the
                page, having no rows to pick, selects its words instead. */}
            {tab === 'chords' && (
              <button
                className="menu__item"
                type="button"
                disabled={chords.sections.length === 0}
                onClick={() => {
                  chords.enterSelect();
                  setMenuOpen(false);
                }}
              >
                <SelectIcon />
                <span>Select</span>
              </button>
            )}

            {tab === 'lyrics' && (
              <button
                className="menu__item"
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                  // After the effect that focuses the page and drops a caret in
                  // it, or that caret would collapse this selection again.
                  requestAnimationFrame(() => {
                    const el = docRef.current;
                    const sel = window.getSelection();
                    if (!el || !sel) return;
                    const all = document.createRange();
                    all.selectNodeContents(el);
                    sel.removeAllRanges();
                    sel.addRange(all);
                  });
                }}
              >
                <SelectIcon />
                <span>Select</span>
              </button>
            )}

            {tab === 'voice' && (
              <button
                className="menu__item"
                type="button"
                disabled={voice.memos.length === 0}
                onClick={() => {
                  voice.enterSelect();
                  setMenuOpen(false);
                }}
              >
                <SelectIcon />
                <span>Select</span>
              </button>
            )}

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
            {/* Per tab, like everything above it: the sections you deleted, or
                the recordings. The page has no rows to have deleted, so it is
                offered and plainly not available. */}
            <button
              className="menu__item"
              type="button"
              disabled={tab === 'lyrics'}
              onClick={() => {
                setMenuOpen(false);
                onTrash(tab === 'voice' ? 'memos' : 'sections');
              }}
            >
              <TrashIcon />
              <span>Recently Deleted</span>
            </button>
            <button
              className="menu__item menu__item--danger"
              type="button"
              onClick={async () => {
                // Drop the pending write first, or it would resurrect the song.
                window.clearTimeout(saveTimer.current);
                pending.current = null;
                // Thrown away rather than destroyed — recordings included, so
                // restoring it out of Recently Deleted brings back all of it.
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

      {/* Held down on the chords tab: what can be done with that one chord. */}
      {chords.held && (
        <ChordMenu
          held={chords.held}
          onClose={chords.release}
          onEdit={() => {
            chords.startEdit(chords.held!.sectionId, chords.held!.chord);
            chords.release();
          }}
          onDelete={async () => {
            const { sectionId, chord } = chords.held!;
            chords.release();
            await chords.removeChord(sectionId, chord.id);
          }}
        />
      )}
    </div>

    {/* Picking a chord takes the whole screen — the fretboard needs the room,
        and the search results share it. Editing opens the same screen with the
        chord's own fingering already on the neck. */}
    {chords.picking && (
      <ChordPicker
        initial={chords.picking.chord}
        leaving={pickerLeaving}
        onCancel={() => closePicker(chords.cancelPick)}
        onConfirm={(chord) => closePicker(() => void chords.savePick(chord))}
      />
    )}
    </>
  );
}
