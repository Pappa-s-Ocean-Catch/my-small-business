use serde::Serialize;
use tauri::State;

use crate::secure_store::{SecureStore, StorageKey, StoreError};

#[derive(Serialize)]
pub struct RegisterRecord { pub id: Option<String>, pub name: Option<String> }

#[tauri::command]
pub fn session_get(store: State<'_, SecureStore>) -> Result<Option<String>, StoreError> { store.get(StorageKey::SupabaseSession) }

#[tauri::command]
pub fn session_set(store: State<'_, SecureStore>, value: String) -> Result<(), StoreError> { store.set(StorageKey::SupabaseSession, &value) }

#[tauri::command]
pub fn session_clear(store: State<'_, SecureStore>) -> Result<(), StoreError> { store.clear(StorageKey::SupabaseSession) }

#[tauri::command]
pub fn register_get(store: State<'_, SecureStore>) -> Result<RegisterRecord, StoreError> {
    Ok(RegisterRecord { id: store.get(StorageKey::RegisterId)?, name: store.get(StorageKey::RegisterName)? })
}

#[tauri::command]
pub fn register_set(store: State<'_, SecureStore>, id: Option<String>, name: Option<String>) -> Result<(), StoreError> {
    if id.is_none() && name.is_none() { return Err(StoreError::invalid("empty register update")); }
    if let Some(value) = id { if !is_register_id(&value) { return Err(StoreError::invalid("register id")); } store.set(StorageKey::RegisterId, &value)?; }
    if let Some(value) = name { let trimmed = value.trim(); if trimmed.is_empty() || trimmed.len() > 80 { return Err(StoreError::invalid("register name")); } store.set(StorageKey::RegisterName, trimmed)?; }
    Ok(())
}

fn is_register_id(value: &str) -> bool {
    value.len() >= 8 && value.chars().all(|character| character.is_ascii_hexdigit() || character == '-')
}
