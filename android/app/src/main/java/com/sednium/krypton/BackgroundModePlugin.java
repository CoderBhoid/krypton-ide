package com.sednium.kryptonide;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin to start/stop the KryptonBackgroundService from the WebView.
 * Usage from JS:
 *   import { Plugins } from '@capacitor/core';
 *   Plugins.BackgroundMode.enable();
 *   Plugins.BackgroundMode.disable();
 */
@CapacitorPlugin(name = "BackgroundMode")
public class BackgroundModePlugin extends Plugin {

    @PluginMethod()
    public void enable(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), KryptonBackgroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
        JSObject result = new JSObject();
        result.put("enabled", true);
        call.resolve(result);
    }

    @PluginMethod()
    public void disable(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), KryptonBackgroundService.class);
        getContext().stopService(serviceIntent);
        JSObject result = new JSObject();
        result.put("enabled", false);
        call.resolve(result);
    }
}
