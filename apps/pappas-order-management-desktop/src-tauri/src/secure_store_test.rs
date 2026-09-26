use crate::secure_store::StorageKey;

#[test]
fn rejects_unknown_storage_key() {
    assert!(StorageKey::try_from("../../session").is_err());
}
