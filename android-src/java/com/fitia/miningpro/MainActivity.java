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
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends Activity {

    private static final String APP_HOST = "app.fitia.pro";
    private static final String START_URL = "https://app.fitia.pro/wallet.html";
    private static final String KEYSTORE_ALIAS = "fitia_pro_hw_vault_v1";
    private static final String PREFS_NAME = "fitia_sec_prefs";

    private static final int PROFILE_PHOTO_REQUEST = 1171;
    private boolean profilePhotoPending = false;
    private String profilePhotoRequestId = "";
    private WebView webView;
    private long lastBackPressMs = 0L;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable pendingClipClear = null;
    private String pendingReferralCode = "";

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
                        path = "/wallet.html";
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

        captureReferralIntent(getIntent());
        if (savedInstanceState == null) {
            webView.loadUrl(START_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureReferralIntent(intent);
        if (webView != null) {
            webView.evaluateJavascript(
                "if(window.App&&App.consumePendingReferralDeepLink){App.consumePendingReferralDeepLink();}",
                null
            );
        }
    }

    // Le lien public transporte uniquement un code de parrainage validé, jamais un secret.
    private synchronized void captureReferralIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null
            || !"fitiapro".equalsIgnoreCase(uri.getScheme())
            || !"parrainage".equalsIgnoreCase(uri.getHost())
            || uri.getPathSegments().size() != 1) return;
        String code = uri.getLastPathSegment();
        if (code == null || !code.matches("(?i)^(?:FITIA-[0-9]{1,78}|0x[0-9a-f]{40})$")) return;
        pendingReferralCode = code;
    }

    private synchronized String consumePendingReferralCode() {
        String code = pendingReferralCode;
        pendingReferralCode = "";
        return code;
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
            if (key == null) return "";
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] iv = cipher.getIV();
            byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return "AKS1:" + Base64.encodeToString(iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(ct, Base64.NO_WRAP);
        } catch (Exception e) {
            // Ne jamais réécrire un coffre sans sa couche AndroidKeyStore.
            return "";
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

    private void selectProfilePhoto(String requestId) {
        if (profilePhotoPending) { deliverProfilePhoto(requestId, "error"); return; }
        profilePhotoRequestId = requestId;
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("image/*");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"image/jpeg", "image/png", "image/webp"});
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            profilePhotoPending = true;
            startActivityForResult(intent, PROFILE_PHOTO_REQUEST);
        } catch (Exception e) {
            profilePhotoPending = false;
            deliverProfilePhoto(requestId, "error");
        }
    }

    private void deliverProfilePhoto(String requestId, String data) {
        mainHandler.post(new Runnable() {
          @Override public void run() {
            if (webView != null) {
                webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('fitia-profile-photo',{detail:"
                    + "{id:" + JSONObject.quote(requestId) + ",data:" + JSONObject.quote(data) + "}}));", null);
            }
          }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PROFILE_PHOTO_REQUEST || !profilePhotoPending) return;
        profilePhotoPending = false;
        final String requestId = profilePhotoRequestId;
        Uri uri = data != null ? data.getData() : null;
        if (resultCode != RESULT_OK || uri == null) { deliverProfilePhoto(requestId, ""); return; }
        // Only content providers selected by the Android picker; never expose content access to the WebView.
        if (!"content".equalsIgnoreCase(uri.getScheme())) { deliverProfilePhoto(requestId, "error"); return; }
        new Thread(new Runnable() {
          @Override public void run() {
            try (InputStream input = getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                if (input == null) throw new IOException("No image");
                byte[] buffer = new byte[8192]; int count; int total = 0;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > 10 * 1024 * 1024) throw new IOException("Image too large");
                    bytes.write(buffer, 0, count);
                }
                byte[] raw = bytes.toByteArray();
                BitmapFactory.Options bounds = new BitmapFactory.Options(); bounds.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(raw, 0, raw.length, bounds);
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0 || bounds.outWidth > 30000 || bounds.outHeight > 30000
                        || !("image/jpeg".equals(bounds.outMimeType) || "image/png".equals(bounds.outMimeType) || "image/webp".equals(bounds.outMimeType))) throw new IOException("Invalid image");
                BitmapFactory.Options options = new BitmapFactory.Options();
                // BitmapFactory.Options defaults to zero on Android; division requires a positive sample size.
                options.inSampleSize = 1;
                while (Math.max(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 1024) options.inSampleSize *= 2;
                Bitmap original = BitmapFactory.decodeByteArray(raw, 0, raw.length, options);
                if (original == null) throw new IOException("Invalid image");
                int size = Math.min(original.getWidth(), original.getHeight());
                Bitmap square = Bitmap.createBitmap(original, (original.getWidth() - size) / 2, (original.getHeight() - size) / 2, size, size);
                Bitmap scaled = Bitmap.createScaledBitmap(square, 256, 256, true);
                ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
                if (!scaled.compress(Bitmap.CompressFormat.JPEG, 80, jpeg)) throw new IOException("Image encoding failed");
                deliverProfilePhoto(requestId, "data:image/jpeg;base64," + Base64.encodeToString(jpeg.toByteArray(), Base64.NO_WRAP));
                if (scaled != square) scaled.recycle();
                if (square != original) square.recycle();
                original.recycle();
            } catch (Exception | OutOfMemoryError e) { deliverProfilePhoto(requestId, "error"); }
          }
        }).start();
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

    // ─── Version de l'application et mise à jour externe ───
    private String getAppVersionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    private long getAppVersionCode() {
        try {
            android.content.pm.PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return info.getLongVersionCode();
            }
            return info.versionCode;
        } catch (Exception e) {
            return 0L;
        }
    }

    // Play Protect bloque les applications capables d'installer des paquets. La mise à jour
    // s'ouvre donc dans le navigateur du système, qui gère seul le téléchargement de l'APK
    // et l'installation avec le consentement standard d'Android.
    private boolean openExternalUpdate(String url) {
        if (url == null || url.length() > 512) return false;
        try {
            java.net.URL parsed = new java.net.URL(url);
            String path = parsed.getPath();
            boolean hostOk = "https".equalsIgnoreCase(parsed.getProtocol())
                && parsed.getUserInfo() == null
                && (parsed.getPort() == -1 || parsed.getPort() == 443)
                && "github.com".equalsIgnoreCase(parsed.getHost())
                && path != null
                && path.startsWith("/web3service/fitia-mining-pro/releases/download/")
                && path.endsWith(".apk");
            if (!hostOk) return false;
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    // ─── Pont JavaScript Natif Sécurisé (@JavascriptInterface) ─────
    public class FitiaBridge {
        private final Context context;

        FitiaBridge(Context ctx) {
            this.context = ctx;
        }

        @JavascriptInterface
        public void chooseProfilePhoto(String requestId) {
            if (requestId == null || !requestId.matches("[A-Za-z0-9-]{1,80}")) return;
            mainHandler.post(new Runnable() {
                @Override public void run() { selectProfilePhoto(requestId); }
            });
        }

        @JavascriptInterface
        public boolean isNativeApk() {
            return true;
        }

        @JavascriptInterface
        public long getAppVersionCode() {
            return MainActivity.this.getAppVersionCode();
        }

        @JavascriptInterface
        public String getAppVersionName() {
            return MainActivity.this.getAppVersionName();
        }

        @JavascriptInterface
        public String consumeReferralDeepLink() {
            return MainActivity.this.consumePendingReferralCode();
        }

        @JavascriptInterface
        public boolean openExternalUpdate(String url) {
            return MainActivity.this.openExternalUpdate(url);
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
