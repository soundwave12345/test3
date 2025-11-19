import fs from 'fs';
import path from 'path';

// --- CONFIGURATION ---
const PACKAGE_PATH = 'android/app/src/main/java/com/subsonic/geministreamer';
const MANIFEST_PATH = 'android/app/src/main/AndroidManifest.xml';
const GRADLE_PATH = 'android/app/build.gradle';

console.log('--- INJECTING GOOGLE CAST PLUGIN ---');

// 1. Create Directory
if (!fs.existsSync(PACKAGE_PATH)) {
    fs.mkdirSync(PACKAGE_PATH, { recursive: true });
}

// 2. Create GoogleCastPlugin.java
const pluginJava = `
package com.subsonic.geministreamer;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import android.os.Handler;
import android.os.Looper;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;
import com.google.android.gms.cast.framework.media.RemoteMediaClient;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.common.images.WebImage;
import android.net.Uri;
import androidx.mediarouter.app.MediaRouteDialogFactory;

@CapacitorPlugin(name = "GoogleCast")
public class GoogleCastPlugin extends Plugin {

    private CastContext castContext;

    @Override
    public void load() {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                castContext = CastContext.getSharedInstance(getContext());
            } catch (Exception e) {
                // Cast not available
            }
        });
    }

    @PluginMethod
    public void initialize(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void showRoutePicker(PluginCall call) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                MediaRouteDialogFactory.getDefault()
                    .onCreateChooserDialogFragment()
                    .show(getActivity().getSupportFragmentManager(), "media_route_chooser");
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void castMedia(PluginCall call) {
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                CastSession session = castContext.getSessionManager().getCurrentCastSession();
                if (session == null || !session.isConnected()) {
                    call.reject("No cast session connected");
                    return;
                }

                String url = call.getString("url");
                String title = call.getString("title");
                String subtitle = call.getString("subtitle");
                String imageUrl = call.getString("imageUrl");
                String mimeType = call.getString("mimeType", "audio/mp3");

                MediaMetadata movieMetadata = new MediaMetadata(MediaMetadata.MEDIA_TYPE_MUSIC_TRACK);
                movieMetadata.putString(MediaMetadata.KEY_TITLE, title);
                movieMetadata.putString(MediaMetadata.KEY_SUBTITLE, subtitle);
                if (imageUrl != null) {
                    movieMetadata.addImage(new WebImage(Uri.parse(imageUrl)));
                }

                MediaInfo mediaInfo = new MediaInfo.Builder(url)
                        .setStreamType(MediaInfo.STREAM_TYPE_BUFFERED)
                        .setContentType(mimeType)
                        .setMetadata(movieMetadata)
                        .build();

                RemoteMediaClient remoteMediaClient = session.getRemoteMediaClient();
                if (remoteMediaClient != null) {
                    remoteMediaClient.load(mediaInfo, true, 0);
                    call.resolve();
                } else {
                    call.reject("RemoteMediaClient null");
                }
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }
}
`;
fs.writeFileSync(path.join(PACKAGE_PATH, 'GoogleCastPlugin.java'), pluginJava);
console.log('Created GoogleCastPlugin.java');

// 3. Create CastOptionsProvider.java
const optionsJava = `
package com.subsonic.geministreamer;

import android.content.Context;
import com.google.android.gms.cast.framework.CastOptions;
import com.google.android.gms.cast.framework.OptionsProvider;
import com.google.android.gms.cast.framework.SessionProvider;
import java.util.List;

public class GoogleCastOptionsProvider implements OptionsProvider {
    @Override
    public CastOptions getCastOptions(Context context) {
        // Uses standard Default Media Receiver
        return new CastOptions.Builder()
                .setReceiverApplicationId(com.google.android.gms.cast.CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
                .build();
    }

    @Override
    public List<SessionProvider> getAdditionalSessionProviders(Context context) {
        return null;
    }
}
`;
fs.writeFileSync(path.join(PACKAGE_PATH, 'GoogleCastOptionsProvider.java'), optionsJava);
console.log('Created GoogleCastOptionsProvider.java');


// 4. Inject Dependency into build.gradle
let gradleContent = fs.readFileSync(GRADLE_PATH, 'utf8');
if (!gradleContent.includes('play-services-cast-framework')) {
    gradleContent = gradleContent.replace(
        'dependencies {',
        'dependencies {\\n    implementation "com.google.android.gms:play-services-cast-framework:21.4.0"'
    );
    fs.writeFileSync(GRADLE_PATH, gradleContent);
    console.log('Injected Cast dependency into build.gradle');
}

// 5. Inject Meta-Data into AndroidManifest.xml
let manifestContent = fs.readFileSync(MANIFEST_PATH, 'utf8');
const metaTag = `
        <meta-data
            android:name="com.google.android.gms.cast.framework.OPTIONS_PROVIDER_CLASS_NAME"
            android:value="com.subsonic.geministreamer.GoogleCastOptionsProvider" />
`;

if (!manifestContent.includes('OPTIONS_PROVIDER_CLASS_NAME')) {
    // Insert before </application>
    manifestContent = manifestContent.replace('</application>', `${metaTag}\\n    </application>`);
    fs.writeFileSync(MANIFEST_PATH, manifestContent);
    console.log('Injected OptionsProvider metadata into AndroidManifest.xml');
}

// 6. Register Plugin in MainActivity.java
const MAIN_ACTIVITY_PATH = path.join(PACKAGE_PATH, 'MainActivity.java');
if (fs.existsSync(MAIN_ACTIVITY_PATH)) {
    let mainActivityContent = fs.readFileSync(MAIN_ACTIVITY_PATH, 'utf8');
    if (!mainActivityContent.includes('GoogleCastPlugin.class')) {
        const onCreateBlock = `
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(GoogleCastPlugin.class);
        super.onCreate(savedInstanceState);
    }
`;
        // Inject inside class by checking for the closing brace of the class
        // Note: This is a simple injection, assuming the last brace is the class closing brace.
        mainActivityContent = mainActivityContent.replace(/}\s*$/, `${onCreateBlock}\n}`);
        fs.writeFileSync(MAIN_ACTIVITY_PATH, mainActivityContent);
        console.log('Registered GoogleCastPlugin in MainActivity.java');
    }
}

console.log('--- INJECTION COMPLETE ---');