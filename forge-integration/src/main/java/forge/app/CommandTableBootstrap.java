package forge.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Color;
import android.view.Gravity;
import android.widget.TextView;
import android.widget.LinearLayout;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * First-launch resource installer. Command Table ships the COMPLETE Forge rules
 * database inside its own APK; customers do not download or configure Forge.
 *
 * Install is done OFF the UI thread and produces a completion marker only after
 * successfully writing all files. An interrupted extraction resumes cleanly on
 * the next start by replacing partial contents.
 */
public final class CommandTableBootstrap extends Activity {
    private static final String RESOURCE_PACK = "command-table-forge-resources.zip";
    private static final String COMPLETE_MARKER = ".command-table-resources-ready";
    private final Handler ui = new Handler(Looper.getMainLooper());
    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout layout = new LinearLayout(this);
        layout.setGravity(Gravity.CENTER);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(36, 36, 36, 36);
        layout.setBackgroundColor(Color.rgb(7, 16, 20));
        status = new TextView(this);
        status.setGravity(Gravity.CENTER);
        status.setTextColor(Color.rgb(223, 234, 235));
        status.setTextSize(19);
        status.setText("Sol Pod\nPreparing your Commander library...");
        layout.addView(status, new LinearLayout.LayoutParams(-1, -2));
        setContentView(layout);

        Thread worker = new Thread(this::prepareResources, "CommandTableResourceInstaller");
        worker.setDaemon(true);
        worker.start();
    }

    private void message(String msg) {
        ui.post(() -> { if (!isFinishing()) status.setText(msg); });
    }

    private void prepareResources() {
        try {
            File storage = getExternalFilesDir(null);
            if (storage == null) throw new IOException("App-specific storage is unavailable");
            File folder = new File(storage, "Forge");
            if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Cannot create data directory");
            File marker = new File(folder, COMPLETE_MARKER);
            File res = new File(folder, "res");

            // Marker is tied to the exact APK version and resource-file date.
            // Rebuilds are installed under their own package identity or rebuild
            // the resources if the APK has changed.
            final String version = getPackageManager()
                .getPackageInfo(getPackageName(), 0).versionName;
            if (!marker.isFile() || !version.equals(Files.readString(marker.toPath()).trim())
                    || !new File(res, "cardsfolder/cardsfolder.zip").isFile()) {
                message("Sol Pod\nInstalling the complete card and rules library.\nThis happens once.");
                if (marker.exists() && !marker.delete()) throw new IOException("Cannot reset marker");
                unpackResources(folder);
                writeText(new File(folder, "version.txt"), version);

                try (InputStream build = getAssets().open("build.txt")) {
                    File buildFile = new File(res, "build.txt");
                    Files.copy(build, buildFile.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                }
                writeText(marker, version);
            }
            ui.post(() -> {
                if (isFinishing()) return;
                startActivity(new Intent(this, CommandTableMain.class));
                finish();
            });
        } catch (Exception error) {
            message("Sol Pod setup could not finish:\n"
                    + (error.getMessage() == null ? error.toString() : error.getMessage())
                    + "\n\nClose and reopen the app. If this repeats, report the error shown.");
            android.util.Log.e("CommandTable", "Embedded Forge resource installation failed", error);
        }
    }

    private void unpackResources(File root) throws IOException {
        byte[] buf = new byte[64 * 1024];
        final String canonicalRoot = root.getCanonicalPath() + File.separator;
        int installed=0;
        try (InputStream raw = getAssets().open(RESOURCE_PACK);
             ZipInputStream zip = new ZipInputStream(raw)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                // Only a complete ".." path segment is traversal. Forge includes
                // valid filenames like "wastetown..tmx" and "R.D.W..dck".
                // Reject Windows separators too: ZIP resources must use '/'.
                String entryName = entry.getName();
                if (entryName.isEmpty() || entryName.startsWith("/")
                        || entryName.indexOf('\\') >= 0 || entryName.indexOf((char) 0) >= 0) {
                    throw new IOException("Invalid bundled resource path: " + entryName);
                }
                for (String part : entryName.split("/")) {
                    if ("..".equals(part) || ".".equals(part)) {
                        throw new IOException("Unsafe bundled resource directory: " + entryName);
                    }
                }
                File destination = new File(root, entryName);
                if (!destination.getCanonicalPath().startsWith(canonicalRoot)) {
                    throw new IOException("Resource path escaped storage directory");
                }
                if (entry.isDirectory()) {
                    if (!destination.isDirectory() && !destination.mkdirs()) throw new IOException("Cannot create folder");
                } else {
                    File parent = destination.getParentFile();
                    if (!parent.isDirectory() && !parent.mkdirs()) throw new IOException("Cannot create folder");
                    try (FileOutputStream out = new FileOutputStream(destination)) {
                        int n;
                        while ((n = zip.read(buf)) != -1) out.write(buf, 0, n);
                    }
                    installed++;
                    if (installed % 300 == 0) message("Command Table\nPreparing the card and rules library...\n"
                            + installed + " resources installed");
                }
                zip.closeEntry();
            }
        }
        if (installed < 100) throw new IOException("Embedded Forge resource archive was incomplete");
    }

    private static void writeText(File file, String text) throws IOException {
        Files.write(file.toPath(), text.getBytes(StandardCharsets.UTF_8));
    }
}
