#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod secure_store;
mod commands;
#[cfg(test)]
mod secure_store_test;

fn main() {
    tauri::Builder::default()
        .manage(secure_store::SecureStore)
        .invoke_handler(tauri::generate_handler![commands::session_get, commands::session_set, commands::session_clear, commands::register_get, commands::register_set])
        .run(tauri::generate_context!())
        .expect("error while running Pappas POS desktop");
}
