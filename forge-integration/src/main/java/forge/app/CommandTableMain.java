package forge.app;

import android.os.Bundle;

/**
 * Command Table Android host: retain Forge's complete libGDX/asset lifecycle,
 * then present our WebView on top of the embedded engine.
 *
 * The display is not installed until Forge's existing native startup reaches
 * its game view. This avoids bypassing first-run resource setup.
 */
public final class CommandTableMain extends Main {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Keep Command Table's own UI visible even during first-run Forge data setup.
        // Game actions stay disabled until the authoritative engine reports ready.
        new android.os.Handler(android.os.Looper.getMainLooper())
                .post(this::showCommandTable);
    }

    @Override
    protected void onDestroy() {
        CommandTableOverlay.release(this);
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if(CommandTableOverlay.handleBack())return;
        super.onBackPressed();
    }

    public void showCommandTable() {
        CommandTableOverlay.install(this);
    }
}
