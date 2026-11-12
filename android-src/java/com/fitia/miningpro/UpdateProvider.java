package com.fitia.miningpro;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

/** Accès en lecture limité au seul APK de mise à jour téléchargé par l'application. */
public class UpdateProvider extends ContentProvider {
    private static final String UPDATE_FILE_NAME = "FITIA-PRO-Miner-update.apk";
    private static final String APK_MIME_TYPE = "application/vnd.android.package-archive";

    public static File getUpdateDir(Context context) {
        return new File(context.getFilesDir(), "updates");
    }

    public static File getUpdateApkFile(Context context) {
        return new File(getUpdateDir(context), UPDATE_FILE_NAME);
    }

    public static Uri getUpdateUri(Context context) {
        return new Uri.Builder()
            .scheme("content")
            .authority(context.getPackageName() + ".updates")
            .appendPath(UPDATE_FILE_NAME)
            .build();
    }

    private boolean isValidUpdateUri(Uri uri) {
        if (uri == null) return false;
        Context context = getContext();
        if (context == null) return false;
        String expectedAuthority = context.getPackageName() + ".updates";
        return "content".equalsIgnoreCase(uri.getScheme())
            && expectedAuthority.equals(uri.getAuthority())
            && ("/" + UPDATE_FILE_NAME).equals(uri.getPath());
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public String getType(Uri uri) {
        return isValidUpdateUri(uri) ? APK_MIME_TYPE : null;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) {
            throw new FileNotFoundException("Lecture seule uniquement");
        }
        Context context = getContext();
        if (context == null || !isValidUpdateUri(uri)) {
            throw new FileNotFoundException("APK introuvable");
        }
        File apk = getUpdateApkFile(context);
        try {
            String dirCanonical = getUpdateDir(context).getCanonicalPath();
            String apkCanonical = apk.getCanonicalPath();
            if (!apkCanonical.startsWith(dirCanonical + File.separator) || !apk.isFile()) {
                throw new FileNotFoundException("APK introuvable");
            }
        } catch (IOException e) {
            throw new FileNotFoundException("APK introuvable");
        }
        return ParcelFileDescriptor.open(apk, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        Context context = getContext();
        if (context == null || !isValidUpdateUri(uri)) return null;
        File apk = getUpdateApkFile(context);
        if (!apk.isFile()) return null;
        String[] columns = projection != null ? projection : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        Object[] values = new Object[columns.length];
        for (int i = 0; i < columns.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[i])) {
                values[i] = UPDATE_FILE_NAME;
            } else if (OpenableColumns.SIZE.equals(columns[i])) {
                values[i] = apk.length();
            } else if ("mime_type".equals(columns[i])) {
                values[i] = APK_MIME_TYPE;
            } else {
                values[i] = null;
            }
        }
        cursor.addRow(values);
        return cursor;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
