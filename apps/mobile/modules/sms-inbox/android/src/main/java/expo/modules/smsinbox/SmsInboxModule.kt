package expo.modules.smsinbox

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Read-only access to the SMS inbox, oldest first, so the app can page through it with `after`. */
class SmsInboxModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var observer: ContentObserver? = null

  private fun hasPermission() =
    ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED

  override fun definition() = ModuleDefinition {
    Name("SmsInbox")

    Events("onSmsReceived")

    // Fires while the app process is alive whenever the SMS store changes (new message saved).
    OnStartObserving("onSmsReceived") {
      if (observer != null) return@OnStartObserving
      val o = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
          sendEvent("onSmsReceived", emptyMap<String, Any>())
        }
      }
      context.contentResolver.registerContentObserver(Telephony.Sms.CONTENT_URI, true, o)
      observer = o
    }

    OnStopObserving("onSmsReceived") {
      observer?.let { context.contentResolver.unregisterContentObserver(it) }
      observer = null
    }

    Function("hasPermission") { hasPermission() }

    AsyncFunction("readAsync") { after: Double, limit: Int ->
      if (!hasPermission()) throw Exceptions.MissingPermissions(Manifest.permission.READ_SMS)
      val messages = mutableListOf<Map<String, Any>>()
      context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        arrayOf(Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE),
        "${Telephony.Sms.DATE} > ?",
        arrayOf(after.toLong().toString()),
        "${Telephony.Sms.DATE} ASC"
      )?.use { cursor ->
        val address = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
        val body = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
        val date = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)
        while (cursor.moveToNext() && messages.size < limit) {
          messages.add(
            mapOf(
              "sender" to (cursor.getString(address) ?: ""),
              "body" to (cursor.getString(body) ?: ""),
              "receivedAt" to cursor.getLong(date).toDouble()
            )
          )
        }
      }
      messages
    }
  }
}
