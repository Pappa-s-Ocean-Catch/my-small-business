package com.pappas.posmirror.ui.settings

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.RadioButton
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import coil.load
import com.pappas.posmirror.R
import com.pappas.posmirror.data.SupabaseRepository
import com.pappas.posmirror.data.model.MirrorSettings
import com.pappas.posmirror.data.model.RegisterOption
import com.pappas.posmirror.data.repository.SettingsRepository
import com.pappas.posmirror.databinding.ActivitySettingsBinding
import com.pappas.posmirror.ui.display.DisplayActivity
import com.pappas.posmirror.ui.login.LoginActivity
import kotlinx.coroutines.launch
import java.io.File
import java.io.FileOutputStream

class SettingsActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySettingsBinding
    private lateinit var settingsRepo: SettingsRepository
    private val supabaseRepo = SupabaseRepository()

    private var availableRegisters: List<RegisterOption> = emptyList()
    private var selectedRegisterId: String = ""
    private var currentIdleMode: String = "image"
    private var currentIdleImageUri: String? = null

    private val pickImageLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        if (uri != null) {
            saveImageLocally(uri)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)

        settingsRepo = SettingsRepository(this)
        if (settingsRepo.getUserId().isNullOrEmpty()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        val initialSettings = settingsRepo.getSettings()

        selectedRegisterId = initialSettings.registerId
        currentIdleMode = initialSettings.idleMode
        currentIdleImageUri = initialSettings.idleImageUri

        // Show back to display button if we already had a configured register
        if (selectedRegisterId.isNotEmpty()) {
            binding.btnBackToDisplay.visibility = View.VISIBLE
            binding.btnBackToDisplay.setOnClickListener {
                startActivity(Intent(this, DisplayActivity::class.java))
                finish()
            }
        }

        binding.switchShowClock.isChecked = initialSettings.showClock

        setupIdleModeUi()
        loadRegisters()

        binding.btnRefreshRegisters.setOnClickListener {
            loadRegisters()
        }

        binding.btnPickImage.setOnClickListener {
            pickImageLauncher.launch("image/*")
        }

        binding.btnResetImage.setOnClickListener {
            currentIdleImageUri = null
            updateImagePreview()
        }

        binding.btnSaveSettings.setOnClickListener {
            saveAndProceed()
        }

        binding.btnSignOut.setOnClickListener {
            confirmSignOut()
        }
    }

    private fun setupIdleModeUi() {
        if (currentIdleMode == "queue") {
            binding.rbIdleQueue.isChecked = true
            binding.layoutImageOptions.visibility = View.GONE
        } else {
            binding.rbIdleImage.isChecked = true
            binding.layoutImageOptions.visibility = View.VISIBLE
        }

        binding.rgIdleMode.setOnCheckedChangeListener { _, checkedId ->
            if (checkedId == R.id.rbIdleQueue) {
                currentIdleMode = "queue"
                binding.layoutImageOptions.visibility = View.GONE
            } else {
                currentIdleMode = "image"
                binding.layoutImageOptions.visibility = View.VISIBLE
            }
        }

        updateImagePreview()
    }

    private fun updateImagePreview() {
        if (!currentIdleImageUri.isNullOrEmpty()) {
            val file = File(currentIdleImageUri!!)
            if (file.exists()) {
                binding.ivCustomPreview.load(file)
                binding.btnResetImage.visibility = View.VISIBLE
                return
            }
        }
        binding.ivCustomPreview.load(R.drawable.idle_artwork)
        binding.btnResetImage.visibility = View.GONE
    }

    private fun saveImageLocally(uri: Uri) {
        try {
            val inputStream = contentResolver.openInputStream(uri) ?: return
            val localFile = File(filesDir, "custom_idle_artwork.jpg")
            FileOutputStream(localFile).use { out ->
                inputStream.copyTo(out)
            }
            currentIdleImageUri = localFile.absolutePath
            updateImagePreview()
        } catch (e: Exception) {
            showError("Could not copy chosen image: ${e.message}")
        }
    }

    private fun loadRegisters() {
        binding.progressRegisters.visibility = View.VISIBLE
        binding.tvEmptyRegisters.visibility = View.GONE
        binding.rgRegisters.removeAllViews()
        hideError()

        lifecycleScope.launch {
            try {
                availableRegisters = supabaseRepo.listRegisters()
                binding.progressRegisters.visibility = View.GONE

                if (availableRegisters.isEmpty()) {
                    binding.tvEmptyRegisters.visibility = View.VISIBLE
                    return@launch
                }

                for (reg in availableRegisters) {
                    val rb = RadioButton(this@SettingsActivity).apply {
                        id = View.generateViewId()
                        text = "${reg.name} (${reg.id})"
                        tag = reg.id
                        textSize = 16f
                        setTextColor(ContextCompat.getColor(this@SettingsActivity, R.color.brand_text))
                        setButtonTintList(ContextCompat.getColorStateList(this@SettingsActivity, R.color.brand_primary))
                        setPadding(16, 16, 16, 16)
                    }

                    binding.rgRegisters.addView(rb)

                    if (reg.id == selectedRegisterId) {
                        rb.isChecked = true
                    }
                }

                binding.rgRegisters.setOnCheckedChangeListener { group, checkedId ->
                    val checkedRb = group.findViewById<RadioButton>(checkedId)
                    if (checkedRb != null) {
                        selectedRegisterId = (checkedRb.tag as? String) ?: ""
                    }
                }
            } catch (e: Exception) {
                binding.progressRegisters.visibility = View.GONE
                showError("Could not load mother POS registers. Check connection and refresh.")
            }
        }
    }

    private fun saveAndProceed() {
        val regId = selectedRegisterId.trim()
        if (regId.isEmpty()) {
            showError("Choose a mother POS register from the list.")
            return
        }

        if (availableRegisters.isNotEmpty() && !availableRegisters.any { it.id == regId }) {
            showError("Selected register is not available. Please pick one from the list.")
            return
        }

        settingsRepo.saveSettings(
            MirrorSettings(
                registerId = regId,
                idleMode = currentIdleMode,
                idleImageUri = currentIdleImageUri,
                showClock = binding.switchShowClock.isChecked
            )
        )

        startActivity(Intent(this, DisplayActivity::class.java))
        finish()
    }

    private fun confirmSignOut() {
        AlertDialog.Builder(this)
            .setTitle("Sign out of POS Mirror?")
            .setMessage("This display will require sign-in before it can be used again.")
            .setPositiveButton("Sign Out") { _, _ ->
                lifecycleScope.launch {
                    supabaseRepo.signOut()
                    settingsRepo.clearAuth()
                    startActivity(Intent(this@SettingsActivity, LoginActivity::class.java))
                    finish()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showError(msg: String) {
        binding.tvSettingsError.text = msg
        binding.tvSettingsError.visibility = View.VISIBLE
    }

    private fun hideError() {
        binding.tvSettingsError.visibility = View.GONE
    }
}
