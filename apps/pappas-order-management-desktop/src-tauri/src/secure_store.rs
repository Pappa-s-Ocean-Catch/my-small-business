use keyring::Entry;
use serde::Serialize;

const SERVICE_NAME: &str = "com.pappas.pos.desktop";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StorageKey {
    SupabaseSession,
    RegisterId,
    RegisterName,
}

impl StorageKey {
    fn account_name(self) -> &'static str {
        match self {
            Self::SupabaseSession => "supabase-session",
            Self::RegisterId => "register-id",
            Self::RegisterName => "register-name",
        }
    }
}

impl TryFrom<&str> for StorageKey {
    type Error = StoreError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "supabase-session" => Ok(Self::SupabaseSession),
            "register-id" => Ok(Self::RegisterId),
            "register-name" => Ok(Self::RegisterName),
            _ => Err(StoreError::invalid("Unknown secure storage key.")),
        }
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct StoreError {
    code: &'static str,
    message: &'static str,
}

impl StoreError {
    fn unavailable() -> Self { Self { code: "SECURE_STORE_UNAVAILABLE", message: "Secure storage is unavailable on this computer." } }
    pub fn invalid(_message: &'static str) -> Self { Self { code: "SECURE_STORE_INVALID_INPUT", message: "Secure storage input is invalid." } }
}

pub struct SecureStore;

impl SecureStore {
    fn entry(key: StorageKey) -> Result<Entry, StoreError> {
        Entry::new(SERVICE_NAME, key.account_name()).map_err(|_| StoreError::unavailable())
    }

    pub fn get(&self, key: StorageKey) -> Result<Option<String>, StoreError> {
        match Self::entry(key)?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(StoreError::unavailable()),
        }
    }

    pub fn set(&self, key: StorageKey, value: &str) -> Result<(), StoreError> {
        if value.trim().is_empty() { return Err(StoreError::invalid("empty")); }
        Self::entry(key)?.set_password(value).map_err(|_| StoreError::unavailable())
    }

    pub fn clear(&self, key: StorageKey) -> Result<(), StoreError> {
        match Self::entry(key)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(StoreError::unavailable()),
        }
    }
}
