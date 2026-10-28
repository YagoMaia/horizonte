package expo.modules.horizontecapture

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class CaptureModule : Module() {
  private fun context() = requireNotNull(appContext.reactContext)
  override fun definition() = ModuleDefinition {
    Name("HorizonteCapture")
    AsyncFunction("hasAccess") {
      val enabled = Settings.Secure.getString(context().contentResolver, "enabled_notification_listeners").orEmpty()
      val component = ComponentName(context(), PurchaseListener::class.java)
      enabled.split(":").any { ComponentName.unflattenFromString(it) == component }
    }
    AsyncFunction("openSettings") {
      context().startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("getApps") {
      val pm = context().packageManager
      val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      pm.queryIntentActivities(intent, 0).map {
        mapOf("packageName" to it.activityInfo.packageName, "name" to it.loadLabel(pm).toString())
      }.distinctBy { it["packageName"] }.filter { it["packageName"] != context().packageName }
    }
    AsyncFunction("configure") { packages: List<String> -> CaptureQueue.configure(context(), packages) }
    AsyncFunction("read") { CaptureQueue.read(context()) }
    AsyncFunction("acknowledge") { ids: List<String> -> CaptureQueue.acknowledge(context(), ids) }
    AsyncFunction("dropped") { CaptureQueue.dropped(context()) }
    AsyncFunction("clear") { CaptureQueue.clear(context()) }
  }
}
