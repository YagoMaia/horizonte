package expo.modules.horizontecapture

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object CaptureQueue {
  private fun prefs(context: Context) = context.getSharedPreferences("horizonte_capture", Context.MODE_PRIVATE)
  @Synchronized fun isEnabled(context: Context, packageName: String): Boolean = prefs(context).getStringSet("packages", emptySet())!!.contains(packageName)
  @Synchronized fun configure(context: Context, packages: List<String>) {
    check(prefs(context).edit().putStringSet("packages", packages.toSet()).commit()) { "Não foi possível salvar os aplicativos de captura." }
  }
  @Synchronized fun add(context: Context, item: JSONObject) {
    if (!isEnabled(context, item.getString("packageName"))) return
    val rows = JSONArray(prefs(context).getString("queue", "[]"))
    for (i in 0 until rows.length()) if (rows.getJSONObject(i).getString("id") == item.getString("id")) return
    // Bound disk use; account for overflow rather than silently claiming full capture.
    val next = JSONArray()
    val start = if (rows.length() >= 1000) 1 else 0
    for (i in start until rows.length()) next.put(rows.getJSONObject(i))
    next.put(item)
    val edit = prefs(context).edit().putString("queue", next.toString())
    if (start > 0) edit.putInt("dropped", prefs(context).getInt("dropped", 0) + 1)
    edit.commit()
  }
  @Synchronized fun read(context: Context): String = prefs(context).getString("queue", "[]")!!
  @Synchronized fun acknowledge(context: Context, ids: List<String>) {
    val rows = JSONArray(read(context)); val next = JSONArray(); val removed = ids.toSet()
    for (i in 0 until rows.length()) if (!removed.contains(rows.getJSONObject(i).getString("id"))) next.put(rows.getJSONObject(i))
    check(prefs(context).edit().putString("queue", next.toString()).commit()) { "Não foi possível confirmar as capturas." }
  }
  @Synchronized fun dropped(context: Context): Int = prefs(context).getInt("dropped", 0)
  @Synchronized fun clear(context: Context) { check(prefs(context).edit().clear().commit()) { "Não foi possível limpar as capturas." } }
}
