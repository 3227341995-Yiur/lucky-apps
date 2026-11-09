use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use tauri::{
  menu::{MenuBuilder, MenuItemBuilder},
  tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
  Manager, RunEvent, WindowEvent, WebviewUrl, WebviewWindowBuilder,
};

struct ServerProcess(Mutex<Option<Child>>);
struct TrayProcess(Mutex<Option<TrayIcon>>);

fn strip_verbatim(path: PathBuf) -> PathBuf {
  let text = path.to_string_lossy();
  if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
    return PathBuf::from(format!(r"\\{rest}"));
  }
  if let Some(rest) = text.strip_prefix(r"\\?\") {
    return PathBuf::from(rest);
  }
  path
}

fn project_root(app: &tauri::AppHandle) -> PathBuf {
  #[cfg(debug_assertions)]
  {
    let _ = app;
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
      .parent()
      .expect("src-tauri parent")
      .to_path_buf()
  }
  #[cfg(not(debug_assertions))]
  {
    strip_verbatim(app.path().resource_dir().expect("resource dir"))
  }
}


fn legacy_data_dir(app_data: &Path) -> Option<PathBuf> {
  let parent = app_data.parent()?;
  let legacy = parent.join("com.lu.dev");
  legacy.is_dir().then_some(legacy)
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
  std::fs::create_dir_all(dst)?;
  for entry in std::fs::read_dir(src)? {
    let entry = entry?;
    let target = dst.join(entry.file_name());
    if entry.file_type()?.is_dir() {
      copy_dir_all(&entry.path(), &target)?;
    } else {
      std::fs::copy(entry.path(), target)?;
    }
  }
  Ok(())
}

/// 旧版本标识是 com.lu.dev；首次用新标识启动时把数据库和用户 profile 迁过来。
fn migrate_legacy_data(app_data: &Path) -> std::io::Result<()> {
  let Some(legacy) = legacy_data_dir(app_data) else {
    return Ok(());
  };
  std::fs::create_dir_all(app_data)?;
  let new_db = app_data.join("week_report.db");
  let old_db = legacy.join("week_report.db");
  if old_db.is_file() && !new_db.exists() {
    std::fs::copy(&old_db, &new_db)?;
    for suffix in ["week_report.db-wal", "week_report.db-shm"] {
      let source = legacy.join(suffix);
      if source.is_file() {
        let _ = std::fs::copy(source, app_data.join(suffix));
      }
    }
  }
  let old_profile = legacy.join("profile");
  let new_profile = app_data.join("profile");
  if old_profile.is_dir() && !new_profile.exists() {
    copy_dir_all(&old_profile, &new_profile)?;
  }
  Ok(())
}

fn spawn_server(app: &tauri::AppHandle) -> Result<(Child, String), String> {
  let root = project_root(app);
  let server_script = root.join("server").join("dist").join("index.mjs");
  let app_data = strip_verbatim(app.path().app_data_dir().map_err(|e| e.to_string())?);
  let env_db = std::env::var("WR_DB_PATH").ok().map(PathBuf::from);
  let env_profile = std::env::var("WR_PROFILE_DIR").ok();
  if env_db.is_none() && env_profile.is_none() {
    if let Err(error) = migrate_legacy_data(&app_data) {
      eprintln!("[shell] 旧数据迁移失败: {error}");
    }
  }
  let has_env_db = env_db.is_some();
  let mut db_path = env_db.unwrap_or_else(|| app_data.join("week_report.db"));
  // 只有没有显式指定数据库时才回退旧标识的数据；测试/多实例不能被旧库覆盖。
  if !has_env_db && !db_path.exists() {
    if let Some(legacy) = legacy_data_dir(&app_data) {
      let legacy_db = legacy.join("week_report.db");
      if legacy_db.is_file() {
        db_path = legacy_db;
      }
    }
  }

  eprintln!("[shell] root={:?} server={:?} db={:?}", root, server_script, db_path);
  let node = std::env::var("WR_NODE_BIN").unwrap_or_else(|_| "node".to_string());
  let mut command = Command::new(&node);
  #[cfg(windows)]
  command.creation_flags(CREATE_NO_WINDOW);
  let mut child = command
    .arg(&server_script)
    .env("WR_APP_ROOT", &root)
    .env("WR_DIST_DIR", root.join("dist"))
    .env("WR_RESOURCES_DIR", root.join("resources"))
    .env("WR_BUNDLED_PROFILE_DIR", if cfg!(debug_assertions) { root.join("src-tauri").join("target").join("profile") } else { root.join("profile") })
    .env("WR_DB_PATH", &db_path)
    .env("WR_PARENT_PID", std::process::id().to_string())
    .env("WR_APP_EXE", std::env::current_exe().unwrap_or_default())
    .env("WR_PORT", "34115")
    .stdout(Stdio::piped())
    .stderr(Stdio::inherit())
    .spawn()
    .map_err(|error| format!("无法启动 Node 服务（{node}）：{error}"))?;

  let stdout = child
    .stdout
    .take()
    .ok_or_else(|| "无法读取 Node 服务输出".to_string())?;
  let mut reader = BufReader::new(stdout);
  let mut url = String::new();
  let mut line = String::new();
  while reader.read_line(&mut line).map_err(|e| e.to_string())? > 0 {
    if let Some(index) = line.find("http://") {
      url = line[index..]
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .to_string();
      break;
    }
    line.clear();
  }
  if url.is_empty() {
    let _ = child.kill();
    return Err("Node 服务未返回启动地址".into());
  }

  // 继续消费 stdout，避免管道写满阻塞服务。
  std::thread::spawn(move || {
    let mut sink = String::new();
    while reader.read_line(&mut sink).unwrap_or(0) > 0 {
      sink.clear();
    }
  });

  Ok((child, url))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
    .setup(|app| {
      let (child, url) = spawn_server(app.handle())?;
      app.manage(ServerProcess(Mutex::new(Some(child))));

      let window = WebviewWindowBuilder::new(
        app,
        "main",
        WebviewUrl::External(url.parse().map_err(|e| format!("无效的服务地址: {e}"))?),
      )
      .title("周报管理系统")
      .inner_size(1400.0, 800.0)
      .resizable(true)
      .devtools(cfg!(debug_assertions))
      .build()?;

      let win = window.clone();
      window.on_window_event(move |event| match event {
        WindowEvent::CloseRequested { api, .. } => {
          api.prevent_close();
          let _ = win.hide();
        }
        WindowEvent::Resized(_) => {
          if win.is_minimized().unwrap_or(false) {
            let _ = win.hide();
          }
        }
        _ => {}
      });

      let show_item = MenuItemBuilder::with_id("show", "显示周报").build(app)?;
      let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
      let menu = MenuBuilder::new(app).items(&[&show_item, &quit_item]).build()?;
      let tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().cloned().expect("window icon"))
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
          "show" => {
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.unminimize();
              let _ = window.set_focus();
            }
          }
          "quit" => app.exit(0),
          _ => {}
        })
        .on_tray_icon_event(|tray, event| {
          if let TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
            let app = tray.app_handle();
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.unminimize();
              let _ = window.set_focus();
            }
          }
        })
        .build(app)?;
      app.manage(TrayProcess(Mutex::new(Some(tray))));

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app, event| {
    if let RunEvent::Exit = event {
      if let Some(state) = app.try_state::<ServerProcess>() {
        if let Some(mut child) = state.0.lock().unwrap().take() {
          let _ = child.kill();
        }
      }
      if let Some(state) = app.try_state::<TrayProcess>() {
        state.0.lock().unwrap().take();
      }
    }
  });
}
