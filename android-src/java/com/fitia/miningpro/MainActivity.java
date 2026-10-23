package com.fitia.miningpro;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.HashMap;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends Activity {

    private static final String APP_HOST = "app.fitia.pro";
    private static final String START_URL = "https://app.fitia.pro/index.html";
    private static final String KEYSTORE_ALIAS = "fitia_pro_hw_vault_v1";
    private static final String PREFS_NAME = "fitia_sec_prefs";

    private WebView webView;
    private long lastBackPressMs = 0L;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable pendingClipClear = null;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Désactive le débogage distant USB WebView en production
        WebView.setWebContentsDebuggingEnabled(false);

        Window window = getWindow();
        if (window != null) {
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            // Active FLAG_SECURE dès le démarrage (écran d'onboarding / PIN protégé contre captures d'écran)
            window.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            window.setStatusBarColor(Color.parseColor("#0F172A"));
            window.setNavigationBarColor(Color.parseColor("#0F172A"));
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0F172A"));
        // Protection anti-Tapjacking (bloque les clics si une application malveillante superpose un écran)
        webView.setFilterTouchesWhenObscured(true);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.setSafeBrowsingEnabled(true);
        }
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setTextZoom(100);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, false);

        ensureHardwareKeyExists();
        webView.addJavascriptInterface(new FitiaBridge(this), "FitiaNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) {
                    return null;
                }
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && APP_HOST.equalsIgnoreCase(uri.getHost())) {
                    String path = uri.getPath();
                    if (path == null || path.isEmpty() || "/".equals(path)) {
                        path = "/index.html";
                    }
                    if (path.contains("..")) {
                        return createNotFoundResponse();
                    }
                    String assetPath = "www" + path;
                    try {
                        InputStream stream = getAssets().open(assetPath);
                        String mime = guessMimeType(path);
                        String encoding = isTextMime(mime) ? "UTF-8" : null;
                        Map<String, String> headers = new HashMap<String, String>();
                        headers.put("Access-Control-Allow-Origin", "https://app.fitia.pro");
                        headers.put("X-Content-Type-Options", "nosniff");
                        headers.put("Cache-Control", "no-cache");
                        return new WebResourceResponse(mime, encoding, 200, "OK", headers, stream);
                    } catch (IOException e) {
                        return createNotFoundResponse();
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) {
                    return false;
                }
                Uri uri = request.getUrl();
                if ("https".equalsIgnoreCase(uri.getScheme()) && APP_HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                if ("https".equalsIgnoreCase(uri.getScheme())) {
                    try {
                        Intent ext = new Intent(Intent.ACTION_VIEW, uri);
                        startActivity(ext);
                    } catch (Exception ignored) {
                    }
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("FITIA PRO")
                    .setMessage(message)
                    .setPositiveButton("OK", new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            result.confirm();
                        }
                    })
                    .setOnCancelListener(new DialogInterface.OnCancelListener() {
                        @Override
                        public void onCancel(DialogInterface dialog) {
                            result.cancel();
                        }
                    })
                    .show();
                return true;
            }

            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("FITIA PRO")
                    .setMessage(message)
                    .setPositiveButton("Confirmer", new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            result.confirm();
                        }
                    })
                    .setNegativeButton("Annuler", new DialogInterface.OnClickListener() {
                        @Override
                        public void onClick(DialogInterface dialog, int which) {
                            result.cancel();
                        }
                    })
                    .setOnCancelListener(new DialogInterface.OnCancelListener() {
                        @Override
                        public void onCancel(DialogInterface dialog) {
                            result.cancel();
                        }
                    })
                    .show();
                return true;
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    // ─── Clé Matérielle AndroidKeyStore (TEE / Non-Exportable) ─────
    private SecretKey ensureHardwareKeyExists() {
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            if (!ks.containsAlias(KEYSTORE_ALIAS)) {
                KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
                KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                    KEYSTORE_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build();
                kg.init(spec);
                return kg.generateKey();
            }
            return ((KeyStore.SecretKeyEntry) ks.getEntry(KEYSTORE_ALIAS, null)).getSecretKey();
        } catch (Exception e) {
            return null;
        }
    }

    private String hardwareSeal(String plaintext) {
        try {
            SecretKey key = ensureHardwareKeyExists();
            if (key == null) return plaintext;
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] iv = cipher.getIV();
            byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return "AKS1:" + Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP);
        } catch (Exception e) {
            return plaintext;
        }
    }

    private String hardwareUnseal(String payload) {
        if (payload == null || !payload.startsWith("AKS1:")) {
            return payload;
        }
        try {
            String[] parts = payload.split(":", 3);
            if (parts.length != 3) return null;
            byte[] iv = Base64.decode(parts[1], Base64.NO_WRAP);
            byte[] ct = Base64.decode(parts[2], Base64.NO_WRAP);
            SecretKey key = ensureHardwareKeyExists();
            if (key == null) return null;
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] pt = cipher.doFinal(ct);
            return new String(pt, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.evaluateJavascript(
                "(function(){ return (window.onAndroidBackPressed && window.onAndroidBackPressed()) ? '1' : '0'; })()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if (value != null && value.contains("1")) {
                            return;
                        }
                        long now = System.currentTimeMillis();
                        if (now - lastBackPressMs < 2000L) {
                            finish();
                        } else {
                            lastBackPressMs = now;
                            Toast.makeText(MainActivity.this, "Appuyez encore pour quitter FITIA PRO", Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            );
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (pendingClipClear != null) {
            mainHandler.removeCallbacks(pendingClipClear);
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private WebResourceResponse createNotFoundResponse() {
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Access-Control-Allow-Origin", "https://app.fitia.pro");
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
    }

    private boolean isTextMime(String mime) {
        return mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg");
    }

    private String guessMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        return "application/octet-stream";
    }

    // ─── Pont JavaScript Natif Sécurisé (@JavascriptInterface) ─────
    public class FitiaBridge {
        private final Context context;

        FitiaBridge(Context ctx) {
            this.context = ctx;
        }

        @JavascriptInterface
        public boolean isNativeApk() {
            return true;
        }

        @JavascriptInterface
        public String sealVault(String data) {
            if (data == null) return "";
            return hardwareSeal(data);
        }

        @JavascriptInterface
        public String unsealVault(String sealedData) {
            if (sealedData == null) return "";
            String res = hardwareUnseal(sealedData);
            return res != null ? res : "";
        }

        @JavascriptInterface
        public void setPinGuardState(String stateJson) {
            SharedPreferences sp = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            sp.edit().putString("pin_guard", stateJson != null ? stateJson : "").apply();
        }

        @JavascriptInterface
        public String getPinGuardState() {
            SharedPreferences sp = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            return sp.getString("pin_guard", "");
        }

        @JavascriptInterface
        public void setScreenSecure(final boolean secure) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Window w = getWindow();
                    if (w != null) {
                        if (secure) {
                            w.addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                        } else {
                            w.clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                        }
                    }
                }
            });
        }

        @JavascriptInterface
        public void copyText(final String text) {
            copySensitiveText(text, 0);
        }

        @JavascriptInterface
        public void copySensitiveText(final String text, final int autoClearMs) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        final ClipboardManager cb = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                        if (cb != null) {
                            cb.setPrimaryClip(ClipData.newPlainText("FITIA PRO", text));
                            if (pendingClipClear != null) {
                                mainHandler.removeCallbacks(pendingClipClear);
                                pendingClipClear = null;
                            }
                            if (autoClearMs > 0) {
                                pendingClipClear = new Runnable() {
                                    @Override
                                    public void run() {
                                        try {
                                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                                cb.clearPrimaryClip();
                                            } else {
                                                cb.setPrimaryClip(ClipData.newPlainText("", ""));
                                            }
                                        } catch (Exception ignored) {
                                        }
                                    }
                                };
                                mainHandler.postDelayed(pendingClipClear, autoClearMs);
                            }
                        }
                    } catch (Exception ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public void vibrate(final int ms) {
            try {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    int dur = Math.max(5, Math.min(ms, 250));
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(dur, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(dur);
                    }
                }
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void shareText(final String title, final String text) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Intent sendIntent = new Intent(Intent.ACTION_SEND);
                        sendIntent.setType("text/plain");
                        sendIntent.putExtra(Intent.EXTRA_SUBJECT, title);
                        sendIntent.putExtra(Intent.EXTRA_TEXT, text);
                        Intent chooser = Intent.createChooser(sendIntent, title);
                        startActivity(chooser);
                    } catch (Exception ignored) {
                    }
                }
            });
        }
    }
}
