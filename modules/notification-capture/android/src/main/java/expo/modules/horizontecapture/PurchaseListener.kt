package expo.modules.horizontecapture

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.security.MessageDigest
import java.util.concurrent.Executors
import org.json.JSONObject

class PurchaseListener : NotificationListenerService() {
  private val worker = Executors.newSingleThreadExecutor()
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (!CaptureQueue.isEnabled(this, sbn.packageName)) return
    val notification = sbn.notification
    if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return
    val extras = notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty().take(500)
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty().take(3000)
    if (text.isBlank()) return
    val time = notification.`when`.takeIf { it > 0 } ?: sbn.postTime
    // Some issuers reuse keys/timestamps. Preserve changed content; financial duplicates go to review.
    val sourceKey = "${sbn.packageName}|${sbn.key}|$time|$title|$text"
    val id = MessageDigest.getInstance("SHA-256").digest(sourceKey.toByteArray()).joinToString("") { "%02x".format(it) }
    val item = JSONObject().put("id", id).put("packageName", sbn.packageName).put("title", title).put("text", text).put("timestamp", time)
    worker.execute { CaptureQueue.add(this, item) }
  }
  override fun onDestroy() { worker.shutdown(); super.onDestroy() }
}
