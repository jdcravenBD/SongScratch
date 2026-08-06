import { useCallback, useEffect, useState } from 'react';
import type { Memo } from '../types';
import { deleteMemo, getMemos, putMemo } from '../db/memos';
import { getSong, putSong } from '../db/songs';
import { newId } from '../lib/id';
import { useRecorder, type Recorder } from './useRecorder';

export interface VoiceMemos {
  memos: Memo[];
  recorder: Recorder;
  /** The memo a resumed take will be added to, or null when recording a new one. */
  appendingTo: string | null;
  startNew: () => void;
  startResume: (memoId: string) => void;
  finish: () => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  removeMany: (ids: string[]) => Promise<void>;
  /** `value` omitted flips each one. */
  setPinned: (ids: string[], value?: boolean) => Promise<void>;

  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  revealedId: string | null;
  setRevealedId: (id: string | null) => void;

  selectMode: boolean;
  selected: Set<string>;
  enterSelect: (id?: string) => void;
  exitSelect: () => void;
  toggleSelect: (id: string) => void;
}

/** Pinned first, then in the order they were recorded. */
const order = (all: Memo[]) =>
  [...all].sort(
    (a, b) => Number(!!b.pinned) - Number(!!a.pinned) || a.createdAt - b.createdAt,
  );

/**
 * Every recording belonging to one song, and the machinery to add to them.
 *
 * Recording new and carrying on with an old memo are the same operation here —
 * both capture a take and then decide where it lands, which is what keeps
 * "add to this one" from being a special case all the way down.
 */
export function useVoiceMemos(songId: string, enabled: boolean): VoiceMemos {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [appendingTo, setAppendingTo] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const recorder = useRecorder();

  /** Reload, and keep the song's badge count in step. */
  const refresh = useCallback(async () => {
    const all = await getMemos(songId);
    setMemos(order(all));
    const song = await getSong(songId);
    if (song && song.voiceCount !== all.length) {
      await putSong({ ...song, voiceCount: all.length, updatedAt: Date.now() });
    }
  }, [songId]);

  // Only while the tab is actually open: reading memos pulls their audio with
  // them, and there is no reason to hold a song's recordings in memory while
  // the user is writing lyrics.
  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const startNew = useCallback(() => {
    setAppendingTo(null);
    void recorder.start();
  }, [recorder]);

  const startResume = useCallback(
    (memoId: string) => {
      setAppendingTo(memoId);
      void recorder.start();
    },
    [recorder],
  );

  const finish = useCallback(async () => {
    const segment = await recorder.stop();
    const target = appendingTo;
    setAppendingTo(null);
    if (!segment) return; // too short to be a recording

    const now = Date.now();
    if (target) {
      const existing = (await getMemos(songId)).find((m) => m.id === target);
      if (existing) {
        await putMemo({
          ...existing,
          segments: [...existing.segments, segment],
          updatedAt: now,
        });
      }
    } else {
      const memo: Memo = {
        id: newId(),
        songId,
        // Named by the user, not by the clock — the row already shows when it
        // was made, so a timestamp for a name would just say it twice.
        name: 'Untitled',
        mimeType: segment.blob.type,
        segments: [segment],
        createdAt: now,
        updatedAt: now,
      };
      await putMemo(memo);
      setExpandedId(memo.id);
    }
    await refresh();
  }, [recorder, appendingTo, songId, refresh]);

  const rename = useCallback(
    async (id: string, name: string) => {
      const memo = memos.find((m) => m.id === id);
      if (!memo) return;
      await putMemo({ ...memo, name, updatedAt: Date.now() });
      await refresh();
    },
    [memos, refresh],
  );

  const removeMany = useCallback(
    async (ids: string[]) => {
      await Promise.all(ids.map(deleteMemo));
      setExpandedId((cur) => (cur && ids.includes(cur) ? null : cur));
      setRevealedId(null);
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback((id: string) => removeMany([id]), [removeMany]);

  const setPinned = useCallback(
    async (ids: string[], value?: boolean) => {
      const targets = memos.filter((m) => ids.includes(m.id));
      await Promise.all(
        targets.map((m) => putMemo({ ...m, pinned: value ?? !m.pinned })),
      );
      setRevealedId(null);
      await refresh();
    },
    [memos, refresh],
  );

  const enterSelect = useCallback((id?: string) => {
    setSelectMode(true);
    setRevealedId(null);
    setExpandedId(null);
    setSelected(id ? new Set([id]) : new Set());
  }, []);

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelected(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  return {
    memos,
    recorder,
    appendingTo,
    startNew,
    startResume,
    finish,
    rename,
    remove,
    removeMany,
    setPinned,
    expandedId,
    setExpandedId,
    revealedId,
    setRevealedId,
    selectMode,
    selected,
    enterSelect,
    exitSelect,
    toggleSelect,
  };
}
