import { useCallback, useEffect, useState } from 'react';
import {
  getDeletedSections,
  getDeletedSongs,
  purgeSections,
  purgeSongs,
  restoreSections,
  restoreSongs,
  TRASH_DAYS,
} from '../db/songs';
import { getDeletedMemos, purgeMemos, restoreMemos } from '../db/memos';
import ScrollArea from './ScrollArea';
import { BackIcon, SelectDot, TrashIcon } from './icons';

const DAY = 86_400_000;

/** Which of the three lists this is standing in for. */
export type TrashKind = 'songs' | 'sections' | 'memos';

export interface TrashTarget {
  kind: TrashKind;
  /** The song whose sections or memos these are. Not needed for songs. */
  songId?: string;
}

interface Props {
  target: TrashTarget;
  /** True while the screen is sliding back off to the right. */
  leaving?: boolean;
  onBack: () => void;
  /** Something came back, so whatever is underneath should read the store again. */
  onRestored: () => void;
}

/** What each kind is called, and how to move it about. */
const UNIT: Record<TrashKind, [one: string, many: string]> = {
  songs: ['Song', 'Songs'],
  sections: ['Section', 'Sections'],
  memos: ['Memo', 'Memos'],
};

interface Item {
  id: string;
  name: string;
  deletedAt?: number;
}

/**
 * Where thrown-away things wait.
 *
 * Deleting anything in the app sends it here rather than destroying it, and it
 * stays for a month. Each list has its own: the ellipsis you opened decides
 * whether this is holding songs, one song's sections, or its recordings.
 *
 * This is the only place anything is really deleted, so it is deliberately a
 * picking screen — nothing happens to an item from a single tap, the way it
 * does in the lists it stands behind.
 */
export default function TrashScreen({ target, leaving, onBack, onRestored }: Props) {
  const { kind, songId } = target;
  const [items, setItems] = useState<Item[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const found: Item[] =
      kind === 'songs'
        ? (await getDeletedSongs()).map((s) => ({
            id: s.id,
            name: s.title || 'New Song',
            deletedAt: s.deletedAt,
          }))
        : kind === 'sections'
          ? (await getDeletedSections(songId ?? '')).map((s) => ({
              id: s.id,
              name: s.name,
              deletedAt: s.deletedAt,
            }))
          : (await getDeletedMemos(songId ?? '')).map((m) => ({
              id: m.id,
              name: m.name,
              deletedAt: m.deletedAt,
            }));
    setItems(found);
    setSelected(new Set());
  }, [kind, songId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const restore = async (ids: string[]) => {
    if (kind === 'songs') await restoreSongs(ids);
    else if (kind === 'sections') await restoreSections(songId ?? '', ids);
    else await restoreMemos(ids);
  };

  const purge = async (ids: string[]) => {
    if (kind === 'songs') await purgeSongs(ids);
    else if (kind === 'sections') await purgeSections(songId ?? '', ids);
    else await purgeMemos(ids);
  };

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const ids = [...selected];
  const count = items?.length ?? 0;
  const picked = ids.length;
  const all = count > 0 && picked === count;
  const [one, many] = UNIT[kind];

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
              onClick={() => setSelected(all ? new Set() : new Set(items?.map((i) => i.id)))}
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
            {picked ? `${picked} Selected` : `${count} ${count === 1 ? one : many}`}
          </p>
        </div>

        {items === null ? null : count === 0 ? (
          <div className="empty">
            <p className="empty__title">Nothing Here</p>
            <p className="empty__hint">
              Deleted {many.toLowerCase()} wait here for {TRASH_DAYS} days before they go
              for good.
            </p>
          </div>
        ) : (
          <ul className="trash__list">
            {items.map((item) => (
              <li className="trash__row" key={item.id}>
                <button
                  className="trash__pick"
                  type="button"
                  aria-pressed={selected.has(item.id)}
                  onClick={() => toggle(item.id)}
                >
                  <span className="trash__check">
                    <SelectDot on={selected.has(item.id)} />
                  </span>
                  <span className="trash__text">
                    <span className="trash__name">{item.name}</span>
                    <span className="trash__meta">{remaining(item.deletedAt)}</span>
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
                await restore(ids);
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
                await purge(ids);
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
