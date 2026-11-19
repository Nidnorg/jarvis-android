package ai.particle.jarvis;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageView;

public class BubbleService extends Service {

    public static boolean RUNNING = false;

    private WindowManager wm;
    private View bubble;
    private WindowManager.LayoutParams lp;
    private static final String CH = "jarvis_bubble";

    @Override
    public void onCreate() {
        super.onCreate();
        RUNNING = true;
        startForeground(1, notif());

        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        float dp = getResources().getDisplayMetrics().density;
        int size = (int) (68 * dp);

        ImageView iv = new ImageView(this);
        iv.setImageResource(R.mipmap.ic_launcher);
        iv.setAlpha(0.95f);
        bubble = iv;

        int type = Build.VERSION.SDK_INT >= 26
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        lp = new WindowManager.LayoutParams(size, size, type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.TOP | Gravity.START;
        lp.x = (int) (16 * dp);
        lp.y = (int) (320 * dp);

        try {
            wm.addView(bubble, lp);
        } catch (Exception e) {
            stopSelf();
            return;
        }

        bubble.setOnTouchListener(new View.OnTouchListener() {
            float downX, downY;
            int originX, originY;
            boolean moved;

            @Override
            public boolean onTouch(View v, MotionEvent e) {
                switch (e.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        downX = e.getRawX(); downY = e.getRawY();
                        originX = lp.x; originY = lp.y; moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE: {
                        int nx = (int) (originX + (e.getRawX() - downX));
                        int ny = (int) (originY + (e.getRawY() - downY));
                        if (Math.abs(nx - originX) + Math.abs(ny - originY) > 10) moved = true;
                        lp.x = nx; lp.y = ny;
                        try { wm.updateViewLayout(bubble, lp); } catch (Exception ignored) {}
                        return true;
                    }
                    case MotionEvent.ACTION_UP:
                        if (!moved) openApp();
                        return true;
                }
                return false;
            }
        });
    }

    private void openApp() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(i);
    }

    private Notification notif() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null && nm.getNotificationChannel(CH) == null) {
                nm.createNotificationChannel(
                        new NotificationChannel(CH, "Jarvis", NotificationManager.IMPORTANCE_LOW));
            }
        }
        PendingIntent pi = PendingIntent.getActivity(this, 0,
                new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CH)
                : new Notification.Builder(this);

        return b.setContentTitle("Jarvis est là")
                .setContentText("La bulle reste sur ton écran")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pi)
                .setOngoing(true)
                .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        RUNNING = false;
        try {
            if (bubble != null && wm != null) wm.removeView(bubble);
        } catch (Exception ignored) {}
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
