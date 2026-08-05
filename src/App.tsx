import DeviceChrome from './components/DeviceChrome';
import SongList from './components/SongList';

/**
 * On desktop the whole app is drawn inside an iPhone 12-shaped frame (see the
 * `.app` frame rules in app.css), so it can be previewed at phone proportions
 * in a browser. On a real phone the frame melts away and it fills the screen.
 */
export default function App() {
  return (
    <div className="app">
      <SongList />
      <DeviceChrome />
    </div>
  );
}
