/**
 * Simulated iPhone 12 hardware — the notch and home indicator — drawn only
 * when the app is shown in the desktop handset frame (see the `.device-chrome`
 * media query in app.css). On a real phone the OS supplies these and the
 * safe-area insets are real, so this stays hidden.
 */
export default function DeviceChrome() {
  return (
    <div className="device-chrome" aria-hidden="true">
      <div className="device-chrome__notch">
        <span className="device-chrome__speaker" />
      </div>
      <div className="device-chrome__home" />
    </div>
  );
}
