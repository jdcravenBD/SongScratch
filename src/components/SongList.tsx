import { useCallback, useMemo, useRef, useState } from 'react';
import { useSongs } from '../hooks/useSongs';
import { useKeyboardInset } from '../hooks/useKeyboardInset';
import { groupSongs } from '../lib/format';
import ScrollArea from './ScrollArea';
import SongRow from './SongRow';
import {
  BackIcon,
  CloseIcon,
  ComposeIcon,
  DuplicateIcon,
  EllipsisIcon,
  PinIcon,
  SearchIcon,
  TrashIcon,
} from './icons';

/** Scroll offsets over which the big title hands off to the compact one. */
const COLLAPSE_FROM = 16;
const COLLAPSE_TO = 52;

/**
 * The home screen: every song the user has, grouped the way Notes groups notes,
 * with search and a New Song button floating at the bottom and a Select mode
 * for acting on several at once.
 */
interface Props {
  onOpen: (id: string) => void;
  onTrash: () => void;
  /** Changes when something outside the list has changed its songs. */
  refreshKey?: number;
  /**
   * Which way this screen is travelling while a song is opened over it: out to
   * the left as one arrives, or back from the left as one leaves.
   */
  shift?: 'out' | 'back' | null;
}

export default function SongList({ onOpen, onTrash, refreshKey, shift }: Props) {
  const { songs, createSong, deleteSongs, duplicateSongs, setPinned } = useSongs(refreshKey);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const keyboardInset = useKeyboardInset();

  const navRef = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  /**
   * Hands the title over from the hero to the nav bar as it scrolls away.
   * Written straight to the DOM: this runs on every scroll frame, and none of
   * it belongs in React state.
   */
  const handleScroll = useCallback((top: number) => {
    const nav = navRef.current;
    if (!nav) return;
    const t = Math.min(1, Math.max(0, (top - COLLAPSE_FROM) / (COLLAPSE_TO - COLLAPSE_FROM)));
    nav.style.setProperty('--collapse', String(t));
  }, []);

  const matches = useMemo(() => {
    if (!songs) return null;
    const q = query.trim().toLowerCase();
    if (!q) return songs;
    return songs.filter((s) =>
      `${s.title} ${s.description ?? ''} ${s.tuning ?? ''}`.toLowerCase().includes(q),
    );
  }, [songs, query]);

  const sections = useMemo(
    () => (matches && !query.trim() ? groupSongs(matches) : null),
    [matches, query],
  );

  const enterSelect = (id?: string) => {
    setSelectMode(true);
    setOpenRowId(null);
    setSelected(id ? new Set([id]) : new Set());
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = !!matches && matches.length > 0 && matches.every((s) => selected.has(s.id));

  const count = selected.size;
  const ids = useMemo(() => [...selected], [selected]);
  /** Unpin when every pick is already pinned, otherwise pin. */
  const pinsAdd = !!songs && !songs.filter((s) => selected.has(s.id)).every((s) => s.pinned);

  const cancelSearch = () => {
    setQuery('');
    setSearching(false);
    searchInput.current?.blur();
  };

  const total = songs?.length ?? 0;
  const showingResults = !!query.trim();
  /** Shared by the hero and the collapsed heading, so they never disagree. */
  const countLabel = showingResults
    ? `${matches?.length ?? 0} found`
    : `${total} ${total === 1 ? 'Song' : 'Songs'}`;

  return (
    /* --kb shortens the screen to sit above the keyboard, so searching moves
       the field rather than shoving the whole list up past the top edge. */
    <div
      className={`screen songs${selectMode ? ' is-selecting' : ''}${
        shift === 'out' ? ' is-standing-aside' : shift === 'back' ? ' is-returning' : ''
      }`}
      style={{ '--kb': `${keyboardInset}px` } as React.CSSProperties}
    >
      <header className="navbar" ref={navRef}>
        <div className="navbar__slot">
          {selectMode ? (
            <button
              className="chip"
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(matches?.map((s) => s.id)))}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          ) : (
            /* This is as far back as the app goes. The button is here so the
               top of the screen doesn't change shape on the way in and out of
               a song — dead, and visibly so. */
            <button className="iconbtn" type="button" disabled aria-hidden="true" tabIndex={-1}>
              <BackIcon />
            </button>
          )}
        </div>

        <div className="navbar__heading">
          <h2 className="navbar__title">
            {selectMode ? (count ? `${count} Selected` : 'Select Songs') : 'All Songs'}
          </h2>
          {!selectMode && <p className="navbar__count">{countLabel}</p>}
        </div>

        <div className="navbar__slot navbar__slot--end">
          {selectMode ? (
            <button className="chip chip--solid" type="button" onClick={exitSelect}>
              Done
            </button>
          ) : (
            <>
              {total > 0 && (
                <button className="chip" type="button" onClick={() => enterSelect()}>
                  Select
                </button>
              )}
              <button
                className="iconbtn"
                type="button"
                aria-label="More actions"
                onClick={() => setMenuOpen(true)}
              >
                <EllipsisIcon />
              </button>
            </>
          )}
        </div>
      </header>

      <ScrollArea onScroll={handleScroll}>
        <div className="hero">
          <h1 className="hero__title">
            {selectMode ? (count ? `${count} Selected` : 'Select Songs') : 'All Songs'}
          </h1>
          <p className="hero__count">{countLabel}</p>
        </div>

        {matches === null ? null : matches.length === 0 ? (
          <div className="empty">
            <p className="empty__title">{showingResults ? 'No Results' : 'No Songs'}</p>
            <p className="empty__hint">
              {showingResults
                ? `Nothing matches “${query.trim()}”.`
                : 'Tap the pencil to start your first song.'}
            </p>
          </div>
        ) : sections ? (
          sections.map((section) => (
            <section className="group" key={section.key}>
              {section.label && <h3 className="group__label">{section.label}</h3>}
              <ul className="list">
                {section.songs.map((song, i) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    index={i}
                    selectMode={selectMode}
                    selected={selected.has(song.id)}
                    forceClosed={openRowId !== null && openRowId !== song.id}
                    onOpen={onOpen}
                    onToggleSelect={toggle}
                    onDelete={(id) => {
                      setOpenRowId(null);
                      void deleteSongs([id]);
                    }}
                    onTogglePin={(id) => void setPinned([id])}
                    onLongPress={enterSelect}
                    onReveal={setOpenRowId}
                  />
                ))}
              </ul>
            </section>
          ))
        ) : (
          <section className="group">
            <ul className="list">
              {matches.map((song, i) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={i}
                  selectMode={selectMode}
                  selected={selected.has(song.id)}
                  forceClosed={openRowId !== null && openRowId !== song.id}
                  onOpen={onOpen}
                  onToggleSelect={toggle}
                  onDelete={(id) => {
                    setOpenRowId(null);
                    void deleteSongs([id]);
                  }}
                  onTogglePin={(id) => void setPinned([id])}
                  onLongPress={enterSelect}
                  onReveal={setOpenRowId}
                />
              ))}
            </ul>
          </section>
        )}
      </ScrollArea>

      <div className="dock">
        {selectMode ? (
          <div className="toolbar">
            <button
              className="tool"
              type="button"
              disabled={!count}
              onClick={async () => {
                await setPinned(ids, pinsAdd);
                exitSelect();
              }}
            >
              <PinIcon />
              <span>{pinsAdd ? 'Pin' : 'Unpin'}</span>
            </button>
            <button
              className="tool"
              type="button"
              disabled={!count}
              onClick={async () => {
                await duplicateSongs(ids);
                exitSelect();
              }}
            >
              <DuplicateIcon />
              <span>Duplicate</span>
            </button>
            <button
              className="tool tool--danger"
              type="button"
              disabled={!count}
              onClick={async () => {
                await deleteSongs(ids);
                exitSelect();
              }}
            >
              <TrashIcon />
              <span>Delete</span>
            </button>
          </div>
        ) : (
          <div className={`dock__bar${searching || query ? ' is-searching' : ''}`}>
            <label className="search">
              <SearchIcon className="search__icon" />
              <input
                ref={searchInput}
                className="search__input"
                type="text"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearching(true)}
                onBlur={() => !query && setSearching(false)}
              />
              {query && (
                <button
                  className="search__clear"
                  type="button"
                  aria-label="Clear search"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery('');
                    searchInput.current?.focus();
                  }}
                >
                  <CloseIcon />
                </button>
              )}
            </label>

            <button className="cancel" type="button" onClick={cancelSearch}>
              Cancel
            </button>

            <button
              className="compose"
              type="button"
              aria-label="New Song"
              onClick={() => void createSong()}
            >
              <ComposeIcon />
            </button>
          </div>
        )}
      </div>

      {menuOpen && (
        <div className="menu" role="dialog" aria-label="Song list actions">
          <button
            className="menu__scrim"
            type="button"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="menu__panel menu__panel--list">
            <button
              className="menu__item"
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onTrash();
              }}
            >
              <TrashIcon />
              <span>Recently Deleted</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

