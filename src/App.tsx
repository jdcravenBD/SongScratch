import { useEffect, useRef, useState } from 'react';
import { purgeExpired } from './db/songs';
import SongList from './components/SongList';
import SongEditor from './components/SongEditor';
import TrashScreen, { type TrashTarget } from './components/TrashScreen';

/** How long a screen takes to arrive or leave. Matches --screen-ms in the CSS. */
const SCREEN_MS = 280;

/**
 * The app fills whatever it is given — a phone, or a browser window while it is
 * being worked on.
 *
 * Navigation is one level deep — the list, or a song open on its tabs — with
 * Recently Deleted laid over whichever of those is showing. A song pushes in
 * from the right the way a system app's does, and the list slides aside under
 * it rather than vanishing, so both screens are on stage together.
 *
 * The list **stays mounted** behind an open song. Unmounting it meant it had to
 * be rebuilt and read the store again on the way back, and it spent the first
 * frames of its own return animation empty — which read as the list lagging
 * behind the song leaving. It re-reads on a bump of `listEpoch` instead.
 */
export default function App() {
  const [openId, setOpenId] = useState<string | null>(null);
  /** The editor, kept on screen while it slides back out. */
  const [closingId, setClosingId] = useState<string | null>(null);
  /**
   * Whether the list is standing aside for an open song. Held rather than
   * derived: an edge swipe unmounts the editor at once, and the list has to be
   * told separately that it can come home.
   */
  const [aside, setAside] = useState(false);
  /** Which Recently Deleted is open, if any — songs, or one song's own. */
  const [trash, setTrash] = useState<TrashTarget | null>(null);
  const [trashLeaving, setTrashLeaving] = useState(false);
  /** Bumped when something underneath has changed from outside it. */
  const [listEpoch, setListEpoch] = useState(0);
  const timer = useRef(0);
  const trashTimer = useRef(0);

  // Songs only wait in Recently Deleted for a month; this is where their time
  // is actually up, since nothing else runs when the app isn't open.
  useEffect(() => {
    void purgeExpired().catch(() => {
      /* a sweep that fails is not worth taking the app down for */
    });
    return () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(trashTimer.current);
    };
  }, []);

  const open = (id: string) => {
    setOpenId(id);
    setAside(true);
  };

  const back = () => {
    setClosingId(openId);
    setOpenId(null);
    setAside(false);
    // The list has been sitting behind an open song and may be out of date by
    // now — it re-reads while it slides back into place, not afterwards.
    setListEpoch((n) => n + 1);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setClosingId(null), SCREEN_MS);
  };

  /**
   * The edge swipe, which has carried both screens itself: the editor off the
   * side, and the list back home behind it. Nothing is left to animate — a
   * leaving animation here would snap the editor back to where it started and
   * slide it away a second time, and a returning one would send the list back
   * out to the left only to bring it in again.
   */
  const dismiss = () => {
    setOpenId(null);
    setClosingId(null);
    setAside(false);
    setListEpoch((n) => n + 1);
    window.clearTimeout(timer.current);
  };

  const closeTrash = () => {
    setTrashLeaving(true);
    window.clearTimeout(trashTimer.current);
    trashTimer.current = window.setTimeout(() => {
      setTrash(null);
      setTrashLeaving(false);
      // Whatever is underneath may be out of date now — a song could have come
      // back from the dead while this was open.
      setListEpoch((n) => n + 1);
    }, SCREEN_MS);
  };

  const showing = openId ?? closingId;

  return (
    <div className="app">
      <SongList
        refreshKey={listEpoch}
        aside={aside}
        onOpen={open}
        onTrash={() => setTrash({ kind: 'songs' })}
      />
      {showing && (
        <SongEditor
          key={showing}
          id={showing}
          leaving={openId === null}
          refreshKey={listEpoch}
          onBack={back}
          onDismiss={dismiss}
          onTrash={(kind) => setTrash({ kind, songId: showing })}
        />
      )}
      {trash && (
        <TrashScreen
          target={trash}
          leaving={trashLeaving}
          onBack={closeTrash}
          onDismiss={() => {
            window.clearTimeout(trashTimer.current);
            setTrash(null);
            setTrashLeaving(false);
            setListEpoch((n) => n + 1);
          }}
          onRestored={() => setListEpoch((n) => n + 1)}
        />
      )}
    </div>
  );
}
