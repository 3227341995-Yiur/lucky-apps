use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

struct ServerProcess(Mutex<Option<Child>>);

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

fn spawn_server(app: &tauri::AppHandle) -> Result<(Child, String), String> {
  let root = project_root(app);
  let server_script = root.join("server").join("dist").join("index.mjs");
  let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
  let db_path = std::env::var("WR_DB_PATH")
    .map(PathBuf::from)
    .unwrap_or_else(|_| app_data.join("week_report.db"));

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
    .env("WR_BUNDLED_PROFILE_DIR", root.join("profile"))
    .env("WR_DB_PATH", &db_path)
    .env("WR_PARENT_PID", std::process::id().to_string())
    .env("WR_PORT", if cfg!(debug_assertions) { "34115" } else { "0" })
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

      WebviewWindowBuilder::new(
        app,
        "main",
        WebviewUrl::External(url.parse().map_err(|e| format!("无效的服务地址: {e}"))?),
      )
      .title("周报管理系统")
      .inner_size(1400.0, 800.0)
      .resizable(true)
      .devtools(cfg!(debug_assertions))
      .build()?;

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
    }
  });
}
