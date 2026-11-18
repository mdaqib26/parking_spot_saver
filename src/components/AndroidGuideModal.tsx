import React, { useState } from 'react';
import { Check, Copy, Smartphone, X } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface AndroidGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CodeTab = 'kotlin' | 'layout' | 'manifest' | 'gradle';

const KOTLIN_MAIN_ACTIVITY = `package com.example.parkingspotsaver

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

class MainActivity : AppCompatActivity() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private val prefs by lazy { getSharedPreferences("parking_spot", Context.MODE_PRIVATE) }
    private val handler = Handler(Looper.getMainLooper())

    private lateinit var tvSavedStatus: TextView
    private lateinit var tvDistance: TextView
    private lateinit var etNote: EditText
    private lateinit var btnNavigate: Button

    private val requestPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) saveMyParkingSpot()
        else Toast.makeText(this, "GPS permission required", Toast.LENGTH_SHORT).show()
    }

    private val ticker = object : Runnable {
        override fun run() {
            refreshSavedSpotUI()
            handler.postDelayed(this, 5000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        tvSavedStatus = findViewById(R.id.tvSavedStatus)
        tvDistance = findViewById(R.id.tvDistance)
        etNote = findViewById(R.id.etNote)
        btnNavigate = findViewById(R.id.btnNavigate)

        findViewById<Button>(R.id.btnSaveSpot).setOnClickListener {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED
            ) {
                saveMyParkingSpot()
            } else {
                requestPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }

        btnNavigate.setOnClickListener {
            val lat = prefs.getFloat("lat", Float.NaN)
            val lng = prefs.getFloat("lng", Float.NaN)
            if (lat.isNaN() || lng.isNaN()) return@setOnClickListener

            val uri = Uri.parse("geo:\$lat,\$lng?q=\$lat,\$lng(My+Parked+Car)")
            val mapIntent = Intent(Intent.ACTION_VIEW, uri).apply {
                setPackage("com.google.android.apps.maps")
            }
            startActivity(mapIntent)
        }
    }

    override fun onResume() {
        super.onResume()
        handler.post(ticker)
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(ticker)
    }

    private fun saveMyParkingSpot() {
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { location ->
                if (location != null) {
                    prefs.edit()
                        .putFloat("lat", location.latitude.toFloat())
                        .putFloat("lng", location.longitude.toFloat())
                        .putLong("savedAt", System.currentTimeMillis())
                        .putString("note", etNote.text.toString())
                        .apply()
                    refreshSavedSpotUI()
                }
            }
    }

    private fun refreshSavedSpotUI() {
        val lat = prefs.getFloat("lat", Float.NaN)
        val lng = prefs.getFloat("lng", Float.NaN)
        val savedAt = prefs.getLong("savedAt", 0L)
        if (lat.isNaN() || lng.isNaN() || savedAt == 0L) {
            tvSavedStatus.text = "No parking spot saved yet"
            tvDistance.text = "--"
            btnNavigate.isEnabled = false
            return
        }

        btnNavigate.isEnabled = true
        val minsAgo = ((System.currentTimeMillis() - savedAt) / 60000).coerceAtLeast(0)
        val note = prefs.getString("note", "") ?: ""
        tvSavedStatus.text = "Saved \${minsAgo}m ago" + if (note.isNotBlank()) " • \$note" else ""

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            == PackageManager.PERMISSION_GRANTED
        ) {
            fusedLocationClient.lastLocation.addOnSuccessListener { current ->
                if (current != null) {
                    val target = Location("saved").apply {
                        latitude = lat.toDouble()
                        longitude = lng.toDouble()
                    }
                    val meters = current.distanceTo(target).toInt()
                    tvDistance.text = "\$meters meters away"
                }
            }
        }
    }
}`;

const XML_LAYOUT = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="24dp"
    android:background="#0B0D11">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Parking Spot Saver"
        android:textColor="#FFFFFF"
        android:textSize="24sp"
        android:textStyle="bold" />

    <EditText
        android:id="@+id/etNote"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="16dp"
        android:hint="Note (e.g. Level 2, pillar B)"
        android:textColor="#FFFFFF"
        android:textColorHint="#9CA3AF" />

    <Button
        android:id="@+id/btnSaveSpot"
        android:layout_width="match_parent"
        android:layout_height="56dp"
        android:layout_marginTop="16dp"
        android:text="Save my parking spot"
        android:backgroundTint="#F59E0B"
        android:textColor="#0B0D11" />

    <TextView
        android:id="@+id/tvSavedStatus"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="24dp"
        android:text="No parking spot saved yet"
        android:textColor="#D1D5DB"
        android:textSize="16sp" />

    <TextView
        android:id="@+id/tvDistance"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="--"
        android:textColor="#FFFFFF"
        android:textSize="28sp"
        android:textStyle="bold" />

    <Button
        android:id="@+id/btnNavigate"
        android:layout_width="match_parent"
        android:layout_height="56dp"
        android:layout_marginTop="24dp"
        android:text="Navigate"
        android:backgroundTint="#10B981"
        android:textColor="#0B0D11" />
</LinearLayout>`;

const ANDROID_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <application
        android:allowBackup="true"
        android:label="Parking Spot Saver">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>`;

const BUILD_GRADLE = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.example.parkingspotsaver"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.parkingspotsaver"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("com.google.android.gms:play-services-location:21.3.0")
}`;

export const AndroidGuideModal: React.FC<AndroidGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<CodeTab>('kotlin');

  if (!isOpen) return null;

  const activeCode =
    tab === 'kotlin'
      ? KOTLIN_MAIN_ACTIVITY
      : tab === 'layout'
        ? XML_LAYOUT
        : tab === 'manifest'
          ? ANDROID_MANIFEST
          : BUILD_GRADLE;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="android-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#14171D] p-5 sm:rounded-3xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
              <Smartphone className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="android-modal-title"
                className="font-display text-lg font-bold text-white"
              >
                Run on Android
              </h2>
              <p className="text-xs text-[#9CA3AF]">
                Install directly on Android Chrome or use native Kotlin code
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Android guide"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#9CA3AF] hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-[#0B0D11] p-4">
          <h3 className="text-sm font-semibold text-white">
            1. Install Directly on Android Phone
          </h3>
          <p className="mt-1.5 text-xs leading-relaxed text-[#9CA3AF]">
            Open this app link in <strong className="text-white">Chrome on Android</strong> and tap <strong className="text-white">Install App</strong> (or Chrome Menu → <strong className="text-white">Add to Home screen</strong>). Uses your phone&apos;s GPS and launches Google Maps directly.
          </p>
          <div className="mt-3">
            <PWAInstallButton />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-[#0B0D11] p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">
                2. Native Android Studio Source
              </h3>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">
                FusedLocationProviderClient · distanceTo() · geo: intent
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/10 bg-[#1C212B] px-3 text-xs font-semibold text-white hover:bg-white/10 whitespace-nowrap shrink-0"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTab('kotlin')}
              className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold ${
                tab === 'kotlin'
                  ? 'bg-amber-500 text-[#0B0D11]'
                  : 'bg-[#1C212B] text-[#9CA3AF] hover:text-white'
              }`}
            >
              MainActivity.kt
            </button>
            <button
              type="button"
              onClick={() => setTab('layout')}
              className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold ${
                tab === 'layout'
                  ? 'bg-amber-500 text-[#0B0D11]'
                  : 'bg-[#1C212B] text-[#9CA3AF] hover:text-white'
              }`}
            >
              activity_main.xml
            </button>
            <button
              type="button"
              onClick={() => setTab('manifest')}
              className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold ${
                tab === 'manifest'
                  ? 'bg-amber-500 text-[#0B0D11]'
                  : 'bg-[#1C212B] text-[#9CA3AF] hover:text-white'
              }`}
            >
              AndroidManifest.xml
            </button>
            <button
              type="button"
              onClick={() => setTab('gradle')}
              className={`min-h-[34px] rounded-lg px-2.5 text-xs font-semibold ${
                tab === 'gradle'
                  ? 'bg-amber-500 text-[#0B0D11]'
                  : 'bg-[#1C212B] text-[#9CA3AF] hover:text-white'
              }`}
            >
              build.gradle.kts
            </button>
          </div>

          <pre className="font-mono-tabular mt-3 max-h-56 overflow-auto rounded-xl border border-white/10 bg-[#07080B] p-3 text-[11px] leading-relaxed text-[#D1D5DB]">
            <code>{activeCode}</code>
          </pre>

          <p className="mt-2.5 text-[11px] leading-relaxed text-[#9CA3AF]">
            In Android Studio: create an <strong className="text-white">Empty Views Activity</strong> project (package <code className="text-amber-300">com.example.parkingspotsaver</code>), paste these 4 files, sync Gradle, then click <strong className="text-white">Build → Build APK(s)</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
