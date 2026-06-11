const { withMainActivity } = require('@expo/config-plugins');

const fullscreenImports = [
  'import android.view.View',
  'import android.view.WindowInsets',
  'import android.view.WindowInsetsController',
];

const fullscreenMethods = `
  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) {
      enterFullscreenMode()
    }
  }

  private fun enterFullscreenMode() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.insetsController?.let { controller ->
        controller.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        controller.systemBarsBehavior =
          WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      }
      return
    }

    @Suppress("DEPRECATION")
    window.decorView.systemUiVisibility = (
      View.SYSTEM_UI_FLAG_FULLSCREEN
        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
      )
  }
`;

function addImports(contents) {
  return fullscreenImports.reduce((nextContents, importLine) => {
    if (nextContents.includes(importLine)) {
      return nextContents;
    }

    return nextContents.replace('import android.os.Bundle', `import android.os.Bundle\n${importLine}`);
  }, contents);
}

function addOnCreateCall(contents) {
  if (contents.includes('super.onCreate(null)\n    enterFullscreenMode()')) {
    return contents;
  }

  return contents.replace('super.onCreate(null)', 'super.onCreate(null)\n    enterFullscreenMode()');
}

function addFullscreenMethods(contents) {
  if (contents.includes('private fun enterFullscreenMode()')) {
    return contents;
  }

  return contents.replace(
    '\n  /**\n   * Returns the name of the main component registered from JavaScript.',
    `${fullscreenMethods}\n  /**\n   * Returns the name of the main component registered from JavaScript.`
  );
}

function withAndroidFullscreen(config) {
  return withMainActivity(config, (config) => {
    if (config.modResults.language !== 'kt') {
      throw new Error('withAndroidFullscreen expects MainActivity.kt');
    }

    config.modResults.contents = addFullscreenMethods(addOnCreateCall(addImports(config.modResults.contents)));
    return config;
  });
}

module.exports = withAndroidFullscreen;
