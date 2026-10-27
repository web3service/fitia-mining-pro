package com.fitia.miningpro;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
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

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends Activity {

    private static final String APP_HOST = "app.fitia.pro";
    private static final String START_URL = "https://app.fitia.pro/wallet.html";
    private static final String KEYSTORE_ALIAS = "fitia_pro_hw_vault_v1";
    private static final String PREFS_NAME = "fitia_sec_prefs";

    private WebView webView;
    private long lastBackPressMs = 0L;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable pendingClipClear = null;
    private boolean updateDownloadInProgress = false;
    private boolean pendingUpdateInstall = false;
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
    protected void onResume() {
        super.onResume();
        if (pendingUpdateInstall && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && getPackageManager().canRequestPackageInstalls()) {
            installDownloadedUpdate();
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

    // ─── Mise à jour APK : HTTPS + SHA-256 + installation Android ───
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

    private boolean isValidUpdateUrl(String value) {
        try {
            URL url = new URL(value);
            String path = url.getPath();
            return "https".equalsIgnoreCase(url.getProtocol())
                && "github.com".equalsIgnoreCase(url.getHost())
                && url.getUserInfo() == null
                && (url.getPort() == -1 || url.getPort() == 443)
                && path != null
                && path.startsWith("/web3service/fitia-mining-pro/releases/download/")
                && path.endsWith(".apk");
        } catch (Exception e) {
            return false;
        }
    }

    private String sha256File(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[16384];
            int read;
            while ((read = input.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        StringBuilder hex = new StringBuilder(64);
        for (byte value : digest.digest()) {
            hex.append(String.format(Locale.US, "%02x", value & 0xff));
        }
        return hex.toString();
    }

    private void showUpdateToast(final String message) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show();
            }
        });
    }

    private void installDownloadedUpdate() {
        File apk = UpdateProvider.getUpdateApkFile(this);
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String expectedSha256 = prefs.getString("update_sha256", "");
        try {
            if (!apk.isFile() || expectedSha256.length() != 64
                || !expectedSha256.equalsIgnoreCase(sha256File(apk))) {
                showUpdateToast("Le fichier de mise à jour est absent ou invalide.");
                return;
            }
        } catch (Exception e) {
            showUpdateToast("Impossible de vérifier la mise à jour.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getPackageManager().canRequestPackageInstalls()) {
            pendingUpdateInstall = true;
            try {
                Intent permissionIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName())
                );
                startActivity(permissionIntent);
                Toast.makeText(this, "Autorisez l’installation pour FITIA PRO, puis revenez à l’application.", Toast.LENGTH_LONG).show();
            } catch (Exception e) {
                showUpdateToast("Autorisez l’installation depuis cette source dans les réglages Android.");
            }
            return;
        }

        try {
            pendingUpdateInstall = false;
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(UpdateProvider.getUpdateUri(this), "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(installIntent);
        } catch (Exception e) {
            showUpdateToast("Impossible d’ouvrir le programme d’installation Android.");
        }
    }

    private boolean startUpdateDownload(final String url, final String expectedSha256) {
        if (!isValidUpdateUrl(url) || expectedSha256 == null
            || !expectedSha256.matches("(?i)^[0-9a-f]{64}$")) {
            return false;
        }
        final String normalizedHash = expectedSha256.toLowerCase(Locale.US);
        final File apk = UpdateProvider.getUpdateApkFile(this);
        File parent = apk.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            return false;
        }

        try {
            if (apk.isFile() && normalizedHash.equalsIgnoreCase(sha256File(apk))) {
                getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit().putString("update_sha256", normalizedHash).apply();
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        installDownloadedUpdate();
                    }
                });
                return true;
            }
        } catch (Exception ignored) {
        }
        if (apk.exists()) apk.delete();

        synchronized (this) {
            if (updateDownloadInProgress) return true;
            updateDownloadInProgress = true;
        }
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().remove("update_sha256").apply();
        showUpdateToast("Téléchargement de la mise à jour…");

        Thread downloadThread = new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection connection = null;
                File partial = new File(apk.getParentFile(), apk.getName() + ".part");
                try {
                    connection = (HttpURLConnection) new URL(url).openConnection();
                    connection.setInstanceFollowRedirects(true);
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(30000);
                    connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
                    connection.setRequestProperty("User-Agent", "FITIA-PRO-Android-Updater");
                    if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                        throw new IOException("Téléchargement refusé");
                    }
                    long maxBytes = 200L * 1024L * 1024L;
                    if (connection.getContentLengthLong() > maxBytes) {
                        throw new IOException("Fichier trop volumineux");
                    }
                    MessageDigest digest = MessageDigest.getInstance("SHA-256");
                    long total = 0L;
                    try (
                        InputStream input = new BufferedInputStream(connection.getInputStream());
                        OutputStream output = new FileOutputStream(partial)
                    ) {
                        byte[] buffer = new byte[16384];
                        int read;
                        while ((read = input.read(buffer)) != -1) {
                            total += read;
                            if (total > maxBytes) throw new IOException("Fichier trop volumineux");
                            digest.update(buffer, 0, read);
                            output.write(buffer, 0, read);
                        }
                    }
                    StringBuilder hex = new StringBuilder(64);
                    for (byte value : digest.digest()) {
                        hex.append(String.format(Locale.US, "%02x", value & 0xff));
                    }
                    if (!normalizedHash.equals(hex.toString())) {
                        throw new IOException("Empreinte SHA-256 différente");
                    }
                    if (apk.exists() && !apk.delete()) throw new IOException("Remplacement impossible");
                    if (!partial.renameTo(apk)) throw new IOException("Enregistrement impossible");
                    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString("update_sha256", normalizedHash).apply();
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "Mise à jour téléchargée. Ouverture de l’installation.", Toast.LENGTH_LONG).show();
                            installDownloadedUpdate();
                        }
                    });
                } catch (Exception e) {
                    if (partial.exists()) partial.delete();
                    if (apk.exists()) apk.delete();
                    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().remove("update_sha256").apply();
                    showUpdateToast("Échec du téléchargement ou de la vérification de la mise à jour.");
                } finally {
                    if (connection != null) connection.disconnect();
                    synchronized (MainActivity.this) {
                        updateDownloadInProgress = false;
                    }
                }
            }
        }, "FitiaUpdateDownload");
        downloadThread.start();
        return true;
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
        public boolean downloadAndInstallUpdate(String url, String expectedSha256) {
            return startUpdateDownload(url, expectedSha256);
        }

        @JavascriptInterface
        public boolean downloadDigitalProduct(String url, String fileName) {
            try {
                Uri uri = Uri.parse(String.valueOf(url));
                String scheme = uri.getScheme();
                String host = uri.getHost();
                String requestPath = uri.getPath();
                String query = uri.getQuery();
                if (!"https".equals(scheme) || !"fitia-mining-pro.vercel.app".equals(host)
                    || !"/api/store-digital".equals(requestPath) || query == null
                    || !query.matches("(?s).*download=[A-Za-z0-9_.-]+\\.[A-Za-z0-9_-]+.*")) {
                    return false;
                }
                String safeName = String.valueOf(fileName).replaceAll("[^A-Za-z0-9._ -]", "_").trim();
                if (safeName.length() == 0 || safeName.length() > 120 || safeName.startsWith(".")) return false;
                DownloadManager.Request request = new DownloadManager.Request(uri);
                request.setTitle(safeName);
                request.setDescription("FITIA STORE — achat numérique vérifié");
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safeName);
                } else {
                    // Aucun accès stockage dangereux n'est demandé sur Android 7–9.
                    request.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, safeName);
                }
                DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
                if (manager == null) return false;
                manager.enqueue(request);
                return true;
            } catch (Exception e) {
                return false;
            }
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
