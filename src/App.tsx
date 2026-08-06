import { useState } from 'react';
import DeviceChrome from './components/DeviceChrome';
import SongList from './components/SongList';
import SongEditor from './components/SongEditor';

/**
 * On desktop the whole app is drawn inside an iPhone 12-shaped frame (see the
 * frame rules in app.css), so it previews at phone proportions in a browser. On
 * a real phone the frame melts away and it fills the screen.
 *
 * Navigation is one level deep — the list, or a song open on its tabs. The list
 * is unmounted while a song is open so it re-reads the store on the way back and
 * shows whatever the editor changed.
 */
export default function App() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="app">
      {openId ? (
        <SongEditor id={openId} onBack={() => setOpenId(null)} />
      ) : (
        <SongList onOpen={setOpenId} />
      )}
      <DeviceChrome />
    </div>
  );
}
