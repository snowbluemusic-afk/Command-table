package com.wardzero.lastflight;

import android.app.Activity;
import android.os.Bundle;
import android.os.Build;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.window.OnBackInvokedDispatcher;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private WebView gameView;

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        gameView = new WebView(this);
        gameView.setBackgroundColor(0xff080e13);
        gameView.setWebViewClient(new WebViewClient());
        gameView.setWebChromeClient(new WebChromeClient());
        gameView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = gameView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        setContentView(gameView);
        try (InputStream in = getAssets().open("index.html");
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            String html = out.toString(StandardCharsets.UTF_8.name());
            gameView.loadDataWithBaseURL("https://wardzero.local/", html,
                    "text/html", "UTF-8", null);
        } catch (IOException e) {
            gameView.loadData("Game assets could not be loaded.", "text/plain", "UTF-8");
        }
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::pauseFromSystemBack);
        }
    }
    private void pauseFromSystemBack() {
        if (gameView != null) gameView.evaluateJavascript(
                "window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));", null);
    }
    @Override public void onBackPressed() { pauseFromSystemBack(); }
    @Override protected void onPause() {
        super.onPause();
        if (gameView != null) gameView.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (gameView != null) gameView.onResume();
    }
    @Override protected void onDestroy() {
        if (gameView != null) gameView.destroy();
        super.onDestroy();
    }
}
