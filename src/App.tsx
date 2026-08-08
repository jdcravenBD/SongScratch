import { useEffect, useRef, useState } from 'react';
import { purgeExpired } from './db/songs';
import DeviceChrome from './components/DeviceChrome';
import SongList from './components/SongList';
import SongEditor from './components/SongEditor';
import TrashScreen from './components/TrashScreen';

/** How long a screen takes to arrive or leave. Matches --screen-ms in the CSS. */
const SCREEN_MS = 280;

/**
 * On desktop the whole app is drawn inside an iPhone 12-shaped frame (see the
 * frame rules in app.css), so it previews at phone proportions in a browser. On
 * a real phone the frame melts away and it fills the screen.
 *
 * Navigation is one level deep — the list, or a song open on its tabs — with
 * Recently Deleted laid over whichever of those is showing. A song pushes in
 * from the right the way a system app's does, which needs both screens on stage
 * at once for the length of the animation: the list is held while the editor
 * arrives, and the editor is held while it leaves. It is unmounted the rest of
 * the time, so it re-reads the store on the way back and shows whatever the
 * editor changed.
 */
export default function App() {
  const [openId, setOpenId] = useState<string | null>(null);
  /** The editor, kept on screen while it slides back out. */
  const [closingId, setClosingId] = useState<string | null>(null);
  /** True while it is sliding in, which is what keeps the list behind it. */
  const [entering, setEntering] = useState(false);
  const [trash, setTrash] = useState(false);
  const [trashLeaving, setTrashLeaving] = useState(false);
  /** Bumped when the list's songs have changed from outside it. */
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
    setEntering(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setEntering(false), SCREEN_MS);
  };

  const back = () => {
    setClosingId(openId);
    setOpenId(null);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setClosingId(null), SCREEN_MS);
  };

  const closeTrash = () => {
    setTrashLeaving(true);
    window.clearTimeout(trashTimer.current);
    trashTimer.current = window.setTimeout(() => {
      setTrash(false);
      setTrashLeaving(false);
      // Whatever is underneath may be out of date now — a song could have come
      // back from the dead while this was open.
      setListEpoch((n) => n + 1);
    }, SCREEN_MS);
  };

  const showing = openId ?? closingId;

  return (
    <div className="app">
      {(openId === null || entering) && (
        <SongList refreshKey={listEpoch} onOpen={open} onTrash={() => setTrash(true)} />
      )}
      {showing && (
        <SongEditor
          key={showing}
          id={showing}
          leaving={openId === null}
          onBack={back}
          onTrash={() => setTrash(true)}
        />
      )}
      {trash && (
        <TrashScreen
          leaving={trashLeaving}
          onBack={closeTrash}
          onRestored={() => setListEpoch((n) => n + 1)}
        />
      )}
      <DeviceChrome />
    </div>
  );
}
