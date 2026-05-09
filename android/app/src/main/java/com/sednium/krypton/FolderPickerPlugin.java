package com.sednium.kryptonide;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Custom Capacitor plugin that opens the native Android folder picker (SAF)
 * via Google Files / default file manager. Returns the selected folder path
 * relative to /storage/emulated/0/ for use with Directory.ExternalStorage.
 */
@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    private static final String TAG = "FolderPickerPlugin";

    @PluginMethod()
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        // Hint the picker to start at the root of primary storage
        Uri initialUri = Uri.parse("content://com.android.externalstorage.documents/document/primary%3A");
        intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, initialUri);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);

        startActivityForResult(call, intent, "folderPickerResult");
    }

    @ActivityCallback
    private void folderPickerResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Folder selection cancelled");
            return;
        }

        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.reject("No folder selected");
            return;
        }

        // Take persistable permission so we can access this folder across app restarts
        try {
            getActivity().getContentResolver().takePersistableUriPermission(
                treeUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            );
        } catch (SecurityException e) {
            Log.w(TAG, "Could not take persistable permission", e);
        }

        // Extract the real filesystem path from the tree URI
        String relativePath = extractRelativePath(treeUri);

        if (relativePath == null || relativePath.isEmpty()) {
            call.reject("Could not resolve folder path. Please select a folder on internal storage.");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("path", relativePath);
        ret.put("uri", treeUri.toString());
        call.resolve(ret);
    }

    /**
     * Extracts the relative path from a SAF tree URI.
     * Example URI: content://com.android.externalstorage.documents/tree/primary%3AKryptonIDE
     * Returns: "KryptonIDE"
     *
     * For root selection: content://com.android.externalstorage.documents/tree/primary%3A
     * Returns: "" (empty, meaning root of external storage)
     */
    private String extractRelativePath(Uri treeUri) {
        String docId = DocumentsContract.getTreeDocumentId(treeUri);
        if (docId == null) return null;

        // docId is typically "primary:FolderName" or "primary:FolderName/SubFolder"
        if (docId.startsWith("primary:")) {
            String path = docId.substring("primary:".length());
            // Remove trailing slash if present
            if (path.endsWith("/")) {
                path = path.substring(0, path.length() - 1);
            }
            return path;
        }

        // For non-primary volumes (SD cards, USB), we can't easily convert
        // to a path usable by Capacitor's ExternalStorage directory.
        // Return null to signal this isn't supported.
        Log.w(TAG, "Non-primary storage selected: " + docId);
        return null;
    }
}
