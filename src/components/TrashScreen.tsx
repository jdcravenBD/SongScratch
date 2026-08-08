import { useCallback, useEffect, useState } from 'react';
import type { Song } from '../types';
import { getDeletedSongs, purgeSongs, restoreSongs, TRASH_DAYS } from '../db/songs';
import ScrollArea from './ScrollArea';
import { BackIcon, SelectDot, TrashIcon } from './icons';

const DAY = 86_400_000;

interface Props {
  /** True while the screen is sliding back off to the right. */
  leaving?: boolean;
  onBack: () => void;
  /** Something came back, so whatever is underneath should read the store again. */
  onRestored: () => void;
}

/**
 * Where thrown-away songs wait.
 *
 * Deleting a song anywhere in the app sends it here rather than destroying it,
 * and it stays for a month. This screen is the only place anything is really
 * deleted, so it is deliberately a picking screen — nothing happens to a song
 * from a single tap, the way it does in the list.
 */
export default function TrashScreen({ leaving, onBack, onRestored }: Props) {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setSongs(await getDeletedSongs());
    setSelected(new Set());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const ids = [...selected];
  const count = songs?.length ?? 0;
  const picked = ids.length;
  const all = count > 0 && picked === count;

  return (
    <div className={`screen trash${leaving ? ' is-leaving' : ''}`}>
      <header className="ebar">
        <button className="iconbtn" type="button" aria-label="Back" onClick={onBack}>
          <BackIcon />
        </button>

        <div className="ebar__end">
          {count > 0 && (
            <button
              className="chip"
              type="button"
              onClick={() => setSelected(all ? new Set() : new Set(songs?.map((s) => s.id)))}
            >
              {all ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
      </header>

      <ScrollArea>
        <div className="hero">
          <h1 className="hero__title">Recently Deleted</h1>
          <p className="hero__count">
            {picked ? `${picked} Selected` : `${count} ${count === 1 ? 'Song' : 'Songs'}`}
          </p>
        </div>

        {songs === null ? null : count === 0 ? (
          <div className="empty">
            <p className="empty__title">Nothing Here</p>
            <p className="empty__hint">
              Deleted songs wait here for {TRASH_DAYS} days before they go for good.
            </p>
          </div>
        ) : (
          <ul className="trash__list">
            {songs.map((song) => (
              <li className="trash__row" key={song.id}>
                <button
                  className="trash__pick"
                  type="button"
                  aria-pressed={selected.has(song.id)}
                  onClick={() => toggle(song.id)}
                >
                  <span className="trash__check">
                    <SelectDot on={selected.has(song.id)} />
                  </span>
                  <span className="trash__text">
                    <span className="trash__name">{song.title || 'New Song'}</span>
                    <span className="trash__meta">{remaining(song.deletedAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="dock">
        {count > 0 && (
          <div className="toolbar">
            <button
              className="tool"
              type="button"
              disabled={!picked}
              onClick={async () => {
                await restoreSongs(ids);
                onRestored();
                await refresh();
              }}
            >
              <BackIcon size={20} />
              <span>Restore</span>
            </button>
            <button
              className="tool tool--danger"
              type="button"
              disabled={!picked}
              onClick={async () => {
                await purgeSongs(ids);
                await refresh();
              }}
            >
              <TrashIcon />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** How long it has left, in the plainest terms that are still true. */
function remaining(deletedAt?: number): string {
  if (!deletedAt) return '';
  const left = TRASH_DAYS - Math.floor((Date.now() - deletedAt) / DAY);
  if (left <= 0) return 'Deleting today';
  if (left === 1) return '1 day left';
  return `${left} days left`;
}
