import { useMemo, useState } from 'react';
import { useSongs } from '../hooks/useSongs';
import SongRow from './SongRow';
import { ComposeIcon, SearchIcon } from './icons';

/**
 * The home screen: the user's songs, with search + a New Song button along the
 * bottom, and a Select mode for acting on several at once. Modelled on iOS
 * Notes / Voice Memos.
 */
export default function SongList() {
  const { songs, createSong, deleteSongs, duplicateSongs } = useSongs();

  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!songs) return null;
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) =>
      `${s.title} ${s.description ?? ''} ${s.tuning ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }, [songs, query]);

  const enterSelect = (id?: string) => {
    setSelectMode(true);
    setOpenRowId(null);
    setSelected(id ? new Set([id]) : new Set());
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allShownSelected =
    !!filtered && filtered.length > 0 && filtered.every((s) => selected.has(s.id));

  const toggleSelectAll = () => {
    if (!filtered) return;
    setSelected(allShownSelected ? new Set() : new Set(filtered.map((s) => s.id)));
  };

  const removeSelected = async () => {
    const ids = [...selected];
    await deleteSongs(ids);
    exitSelect();
  };

  const duplicateSelected = async () => {
    await duplicateSongs([...selected]);
    exitSelect();
  };

  const handleDelete = async (id: string) => {
    setOpenRowId(null);
    await deleteSongs([id]);
  };

  const handleNew = async () => {
    await createSong();
    // Editor screen comes in a later step; for now the song appears at the top
    // of the list, ready to be opened once that screen exists.
  };

  const count = selected.size;
  const hasSongs = !!songs && songs.length > 0;

  return (
    <div className="screen">
      <header className="topbar">
        <div className="topbar__row">
          <div className="topbar__slot topbar__slot--left">
            {selectMode && (
              <button className="btn-text" type="button" onClick={toggleSelectAll}>
                {allShownSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
          <div className="topbar__slot topbar__slot--right">
            {selectMode ? (
              <button className="btn-text" type="button" onClick={exitSelect}>
                Done
              </button>
            ) : (
              hasSongs && (
                <button
                  className="btn-text"
                  type="button"
                  onClick={() => enterSelect()}
                >
                  Select
                </button>
              )
            )}
          </div>
        </div>
        <h1 className="topbar__title">
          {selectMode
            ? count === 0
              ? 'Select Songs'
              : `${count} Selected`
            : 'All Songs'}
        </h1>
        {!selectMode && songs && (
          <p className="topbar__subtitle">
            {songs.length} {songs.length === 1 ? 'Song' : 'Songs'}
          </p>
        )}
      </header>

      <main className="list-area">
        {filtered === null ? null : filtered.length === 0 ? (
          <div className="empty">
            <p className="empty__title">
              {query ? 'No Results' : 'No Songs'}
            </p>
            <p className="empty__hint">
              {query
                ? 'Try a different search.'
                : 'Tap the compose button to start a new song.'}
            </p>
          </div>
        ) : (
          <ul className="card">
            {filtered.map((song) => (
              <SongRow
                key={song.id}
                song={song}
                selectMode={selectMode}
                selected={selected.has(song.id)}
                forceClosed={openRowId !== null && openRowId !== song.id}
                onOpen={(id) => onOpenSong(id)}
                onToggleSelect={toggle}
                onDelete={handleDelete}
                onLongPress={enterSelect}
                onReveal={setOpenRowId}
              />
            ))}
          </ul>
        )}
      </main>

      {selectMode ? (
        <div className="bottombar bottombar--actions">
          <button
            className="action"
            type="button"
            disabled={count === 0}
            onClick={duplicateSelected}
          >
            Duplicate
          </button>
          <button
            className="action action--danger"
            type="button"
            disabled={count === 0}
            onClick={removeSelected}
          >
            Delete{count > 0 ? ` (${count})` : ''}
          </button>
        </div>
      ) : (
        <div className="bottombar">
          <label className="search">
            <SearchIcon className="search__icon" />
            <input
              className="search__input"
              type="search"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button
            className="compose"
            type="button"
            aria-label="New Song"
            onClick={handleNew}
          >
            <ComposeIcon />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Opening a song lands on its Chords/Lyrics/Voice tabs — the screen built in
 * the next step. Wired here as a stub so the tap gesture is already in place.
 */
function onOpenSong(id: string) {
  if (import.meta.env.DEV) console.info('open song', id);
}
