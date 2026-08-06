import { useCallback, useEffect, useState } from 'react';
import type { Memo } from '../types';
import { deleteMemo, getMemos, putMemo } from '../db/memos';
import { getSong, putSong } from '../db/songs';
import { newId } from '../lib/id';
import { formatStamp } from '../lib/format';
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
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  revealedId: string | null;
  setRevealedId: (id: string | null) => void;
}

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

  const recorder = useRecorder();

  /** Reload, and keep the song's badge count in step. */
  const refresh = useCallback(async () => {
    const all = await getMemos(songId);
    setMemos(all);
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
        name: formatStamp(now),
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

  const remove = useCallback(
    async (id: string) => {
      await deleteMemo(id);
      setExpandedId((cur) => (cur === id ? null : cur));
      setRevealedId(null);
      await refresh();
    },
    [refresh],
  );

  return {
    memos,
    recorder,
    appendingTo,
    startNew,
    startResume,
    finish,
    rename,
    remove,
    expandedId,
    setExpandedId,
    revealedId,
    setRevealedId,
  };
}
