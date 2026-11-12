const SESSION_KEYCHAIN_SERVICE: &str = "com.entcare.desktop.daily-session";

#[tauri::command]
fn store_daily_session_secret(email: String, secret: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SESSION_KEYCHAIN_SERVICE, &email)
        .map_err(|error| format!("Could not access the macOS Keychain: {error}"))?;
    entry
        .set_password(&secret)
        .map_err(|error| format!("Could not save the daily session in macOS Keychain: {error}"))
}

#[tauri::command]
fn load_daily_session_secret(email: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SESSION_KEYCHAIN_SERVICE, &email)
        .map_err(|error| format!("Could not access the macOS Keychain: {error}"))?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Could not read the daily session from macOS Keychain: {error}")),
    }
}

#[tauri::command]
fn delete_daily_session_secret(email: String) -> Result<(), String> {
    let entry = keyring::Entry::new(SESSION_KEYCHAIN_SERVICE, &email)
        .map_err(|error| format!("Could not access the macOS Keychain: {error}"))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Could not remove the daily session from macOS Keychain: {error}")),
    }
}

#[tauri::command]
fn print_current_window(webview: tauri::WebviewWindow) -> Result<(), String> {
    webview
        .print()
        .map_err(|error| format!("Could not open the system print dialog: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;
    use tauri_plugin_sql::{Migration, MigrationKind};

    let migrations = vec![
        Migration {
            version: 1,
            description: "create_auth_session",
            sql: "CREATE TABLE IF NOT EXISTS auth_session (
            session_id TEXT PRIMARY KEY NOT NULL CHECK (session_id = 'current'),
            email TEXT NOT NULL,
            user_json TEXT NOT NULL,
            token_issued_at TEXT,
            vault_path TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_patient_visits",
            sql: "CREATE TABLE IF NOT EXISTS patient_visits (
            visit_id TEXT PRIMARY KEY NOT NULL,
            created_at TEXT NOT NULL
        );",
            kind: MigrationKind::Up,
        },
        Migration {
        version: 3,
        description: "create_referrals",
        sql: "CREATE TABLE IF NOT EXISTS referrals (
        referral_id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'submitted'))
        );",
        kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "link_patient_reports",
            sql: "ALTER TABLE patient_visits ADD COLUMN tracking_id TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "mark_visits_with_diagnosis",
            sql: "ALTER TABLE patient_visits ADD COLUMN has_diagnosis INTEGER NOT NULL DEFAULT 0;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "record_interactive_login_time",
            sql: "ALTER TABLE auth_session ADD COLUMN last_login_at TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "store_encrypted_patient_intake",
            sql: "ALTER TABLE patient_visits ADD COLUMN data_ciphertext TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "store_encrypted_diagnosis_reports",
            sql: "ALTER TABLE patient_visits ADD COLUMN diagnosis_ciphertext TEXT;",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            store_daily_session_secret,
            load_daily_session_secret,
            delete_daily_session_secret,
            print_current_window
        ])
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:ent-care.db", migrations)
                .build(),
        )
        .setup(|app| {
            let local_data_dir = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&local_data_dir)?;
            let salt_path = local_data_dir.join("stronghold-salt.txt");
            app.handle().plugin(
                tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build(),
            )?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ENT-Care desktop application");
}
