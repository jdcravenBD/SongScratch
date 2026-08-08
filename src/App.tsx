import { useEffect, useRef, useState } from 'react';
import DeviceChrome from './components/DeviceChrome';
import SongList from './components/SongList';
import SongEditor from './components/SongEditor';

/** How long a screen takes to arrive or leave. Matches --screen-ms in the CSS. */
const SCREEN_MS = 280;

/**
 * On desktop the whole app is drawn inside an iPhone 12-shaped frame (see the
 * frame rules in app.css), so it previews at phone proportions in a browser. On
 * a real phone the frame melts away and it fills the screen.
 *
 * Navigation is one level deep — the list, or a song open on its tabs — and a
 * song pushes in from the right over the list the way a system app's does. That
 * needs both screens on stage at once for the length of the animation: the list
 * is held while the editor arrives, and the editor is held while it leaves. It
 * is unmounted the rest of the time, so it re-reads the store on the way back
 * and shows whatever the editor changed.
 */
export default function App() {
  const [openId, setOpenId] = useState<string | null>(null);
  /** The editor, kept on screen while it slides back out. */
  const [closingId, setClosingId] = useState<string | null>(null);
  /** True while it is sliding in, which is what keeps the list behind it. */
  const [entering, setEntering] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const after = (ms: number, done: () => void) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(done, ms);
  };

  const open = (id: string) => {
    setOpenId(id);
    setEntering(true);
    after(SCREEN_MS, () => setEntering(false));
  };

  const back = () => {
    setClosingId(openId);
    setOpenId(null);
    after(SCREEN_MS, () => setClosingId(null));
  };

  /**
   * The edge swipe, which has already carried the screen off the side itself.
   * Playing the leaving animation on top of that would snap it back to where it
   * started and slide it away a second time.
   */
  const dismiss = () => {
    window.clearTimeout(timer.current);
    setOpenId(null);
    setClosingId(null);
  };

  const showing = openId ?? closingId;

  return (
    <div className="app">
      {(openId === null || entering) && <SongList onOpen={open} />}
      {showing && (
        <SongEditor
          key={showing}
          id={showing}
          leaving={openId === null}
          onBack={back}
          onDismiss={dismiss}
        />
      )}
      <DeviceChrome />
    </div>
  );
}
