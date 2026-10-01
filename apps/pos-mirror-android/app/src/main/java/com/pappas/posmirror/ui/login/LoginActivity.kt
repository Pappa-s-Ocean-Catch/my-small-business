package com.pappas.posmirror.ui.login

import android.content.Context
import android.content.Intent
import android.graphics.Rect
import android.os.Bundle
import android.view.MotionEvent
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.pappas.posmirror.data.SupabaseRepository
import com.pappas.posmirror.data.repository.SettingsRepository
import com.pappas.posmirror.databinding.ActivityLoginBinding
import com.pappas.posmirror.ui.display.DisplayActivity
import com.pappas.posmirror.ui.settings.SettingsActivity
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var settingsRepo: SettingsRepository
    private val supabaseRepo = SupabaseRepository()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enableImmersiveMode()

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        settingsRepo = SettingsRepository(this)

        // Restore remembered email if configured
        val rememberEmail = settingsRepo.isRememberEmail()
        binding.cbRememberEmail.isChecked = rememberEmail
        if (rememberEmail) {
            val savedEmail = settingsRepo.getSavedEmail()
            if (!savedEmail.isNullOrBlank()) {
                binding.etEmail.setText(savedEmail)
                binding.etPassword.requestFocus()
            }
        }

        binding.cbRememberEmail.setOnCheckedChangeListener { _, isChecked ->
            settingsRepo.setRememberEmail(isChecked)
            if (!isChecked) {
                settingsRepo.saveEmail(null)
            }
        }

        // Check if already authenticated (unless force_show_login extra is passed)
        val forceShowLogin = intent.getBooleanExtra("force_show_login", false)
        val savedUserId = settingsRepo.getUserId()
        val savedToken = settingsRepo.getAccessToken()
        val savedRefresh = settingsRepo.getRefreshToken()
        val savedSettings = settingsRepo.getSettings()

        if (!forceShowLogin && !savedUserId.isNullOrEmpty() && !savedToken.isNullOrEmpty() && !savedRefresh.isNullOrEmpty()) {
            setLoading(true)
            lifecycleScope.launch {
                val restored = supabaseRepo.restoreSession(savedToken, savedRefresh)
                if (restored) {
                    val hasAccess = supabaseRepo.canAccessPosMirror(savedUserId)
                    if (hasAccess) {
                        if (savedSettings.registerId.isNotEmpty()) {
                            startActivity(Intent(this@LoginActivity, DisplayActivity::class.java))
                        } else {
                            startActivity(Intent(this@LoginActivity, SettingsActivity::class.java))
                        }
                        finish()
                        return@launch
                    }
                }
                settingsRepo.clearAuth()
                setLoading(false)
            }
        }

        binding.btnSignIn.setOnClickListener {
            attemptLogin()
        }
    }

    private fun attemptLogin() {
        val email = binding.etEmail.text?.toString()?.trim() ?: ""
        val password = binding.etPassword.text?.toString() ?: ""

        if (email.isEmpty() || password.isEmpty()) {
            showError("Enter both your email and password.")
            return
        }

        // Persist email in app data if remember is enabled
        if (binding.cbRememberEmail.isChecked) {
            settingsRepo.saveEmail(email)
            settingsRepo.setRememberEmail(true)
        } else {
            settingsRepo.saveEmail(null)
            settingsRepo.setRememberEmail(false)
        }

        setLoading(true)
        hideError()

        lifecycleScope.launch {
            try {
                val session = supabaseRepo.signIn(email, password)
                val userId = session.user?.id ?: throw Exception("User ID not found")
                val hasAccess = supabaseRepo.canAccessPosMirror(userId)

                if (!hasAccess) {
                    supabaseRepo.signOut()
                    showError("Authorized account access is required for POS Mirror.")
                    setLoading(false)
                    return@launch
                }

                settingsRepo.saveAuth(session.accessToken, session.refreshToken, userId)

                val settings = settingsRepo.getSettings()
                if (settings.registerId.isNotEmpty()) {
                    startActivity(Intent(this@LoginActivity, DisplayActivity::class.java))
                } else {
                    startActivity(Intent(this@LoginActivity, SettingsActivity::class.java))
                }
                finish()
            } catch (e: Exception) {
                showError(e.message ?: "Could not sign in. Check the connection and try again.")
                setLoading(false)
            }
        }
    }

    private fun setLoading(loading: Boolean) {
        binding.btnSignIn.isEnabled = !loading
        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
    }

    private fun showError(msg: String) {
        binding.tvError.text = msg
        binding.tvError.visibility = View.VISIBLE
    }

    private fun hideError() {
        binding.tvError.visibility = View.GONE
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (ev.action == MotionEvent.ACTION_DOWN) {
            val view = currentFocus
            if (view is EditText) {
                val outRect = Rect()
                view.getGlobalVisibleRect(outRect)
                if (!outRect.contains(ev.rawX.toInt(), ev.rawY.toInt())) {
                    view.clearFocus()
                    val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
                    imm?.hideSoftInputFromWindow(view.windowToken, 0)
                    enableImmersiveMode()
                }
            }
        }
        return super.dispatchTouchEvent(ev)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            enableImmersiveMode()
        }
    }

    private fun enableImmersiveMode() {
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        or View.SYSTEM_UI_FLAG_FULLSCREEN
                        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                )
    }
}
