package com.sednium.krypton;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.util.Log;

import java.io.File;

@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("Must provide an apk path");
            return;
        }

        try {
            // Capacitor format usually gives "file:///..."
            if (path.startsWith("file://")) {
                path = path.substring(7);
            }
            
            File apkFile = new File(path);
            if (!apkFile.exists()) {
                call.reject("APK file does not exist at path: " + path);
                return;
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(getUriForFile(apkFile), "application/vnd.android.package-archive");
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception ex) {
            Log.e("ApkInstaller", "Failed to install APK", ex);
            call.reject("Failed to install APK: " + ex.getMessage());
        }
    }

    private Uri getUriForFile(File file) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            return FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
        } else {
            return Uri.fromFile(file);
        }
    }
}
