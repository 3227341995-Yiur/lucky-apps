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

impl Drop for ServerProcess {
  fn drop(&mut self) {
    if let Some(mut child) = self.0.lock().unwrap().take() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }
}

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


/// 依次尝试旧标识目录：上一代产品 com.lu.week-report，更早的 com.lu.dev。
fn legacy_data_dir(app_data: &Path) -> Option<PathBuf> {
  let parent = app_data.parent()?;
  ["com.lu.week-report", "com.lu.dev"]
    .iter()
    .map(|name| parent.join(name))
    .find(|dir| dir.is_dir())
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

/// 旧版本标识（com.lu.week-report / com.lu.dev）首次用新标识启动时，
/// 把数据库和用户 profile 迁过来。旧库文件名为 week_report.db。
fn migrate_legacy_data(app_data: &Path) -> std::io::Result<()> {
  let Some(legacy) = legacy_data_dir(app_data) else {
    return Ok(());
  };
  std::fs::create_dir_all(app_data)?;
  let new_db = app_data.join("lucky_apps.db");
  let old_db = ["week_report.db", "lucky_apps.db"]
    .iter()
    .map(|name| legacy.join(name))
    .find(|path| path.is_file());
  if let Some(old_db) = old_db {
    if !new_db.exists() {
      std::fs::copy(&old_db, &new_db)?;
      for suffix in ["-wal", "-shm"] {
        let source = old_db.with_file_name(format!("{}{}", old_db.file_name().unwrap().to_string_lossy(), suffix));
        if source.is_file() {
          let target = app_data.join(format!("lucky_apps.db{suffix}"));
          let _ = std::fs::copy(source, target);
        }
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

fn server_url_from_line(line: &str) -> Option<String> {
  if !line.contains("[server] ready") {
    return None;
  }
  let index = line.find("http://")?;
  Some(line[index..].split_whitespace().next()?.to_string())
}

// ============================================================
// 程序品牌：窗口标题、窗口/托盘图标、exe 文件图标
// ============================================================
#[derive(Clone, serde::Serialize, serde::Deserialize, Default)]
struct SavedBranding {
  name: String,
  width: u32,
  height: u32,
  /// 上次写入 exe 图标后的文件指纹，升级换 exe 后自动补写图标。
  #[serde(default)]
  exe_hash: u64,
}

fn file_hash(path: &Path) -> Option<u64> {
  let bytes = std::fs::read(path).ok()?;
  let mut hash = 0xcbf2_9ce4_8422_2325u64;
  for byte in bytes {
    hash ^= byte as u64;
    hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
  }
  Some(hash)
}

#[derive(serde::Deserialize)]
struct BrandingIcon {
  rgba: Vec<u8>,
  width: u32,
  height: u32,
  ico: Vec<u8>,
}

fn branding_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = strip_verbatim(app.path().app_data_dir().map_err(|e| e.to_string())?);
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

fn tray_handle(app: &tauri::AppHandle) -> Option<tauri::tray::TrayIcon> {
  app.try_state::<TrayProcess>()?.0.lock().unwrap().clone()
}

/// Tauri 的 set_icon 只设置 WM_SETICON 的小图标（标题栏），任务栏/Alt-Tab 用的大图标要单独设置。
#[cfg(windows)]
fn apply_taskbar_icon(window: &tauri::WebviewWindow, ico: &[u8]) -> Result<(), String> {
  use std::sync::atomic::{AtomicIsize, Ordering};
  use windows_sys::Win32::UI::WindowsAndMessaging::{
    CreateIconFromResourceEx, DestroyIcon, SendMessageW, SetClassLongPtrW, SetWindowPos,
    GCLP_HICON, GCLP_HICONSM, ICON_BIG, ICON_SMALL, ICON_SMALL2, SWP_FRAMECHANGED, SWP_NOMOVE,
    SWP_NOSIZE, SWP_NOZORDER, WM_SETICON,
  };

  static BIG_ICON: AtomicIsize = AtomicIsize::new(0);
  static SMALL_ICON: AtomicIsize = AtomicIsize::new(0);
  let entries = ico_entries(ico)?;
  let create = |want: u32| -> Result<isize, String> {
    let (size, offset, len) = entries.iter()
      .find(|(size, _, _)| *size == want)
      .or_else(|| entries.iter().find(|(size, _, _)| *size >= want))
      .or_else(|| entries.iter().max_by_key(|(size, _, _)| *size))
      .copied()
      .ok_or("ico 文件没有图标条目")?;
    let image = unsafe {
      CreateIconFromResourceEx(
        ico[offset..].as_ptr(),
        len as u32,
        1,
        0x0003_0000,
        size as i32,
        size as i32,
        0,
      )
    };
    if image.is_null() {
      return Err("无法创建图标".into());
    }
    Ok(image as isize)
  };
  let big = create(48)?;
  let small = create(32).unwrap_or(big);
  let hwnd = window.hwnd().map_err(|error| error.to_string())?;
  unsafe {
    SendMessageW(hwnd.0 as _, WM_SETICON, ICON_BIG as usize, big);
    SendMessageW(hwnd.0 as _, WM_SETICON, ICON_SMALL as usize, small);
    SendMessageW(hwnd.0 as _, WM_SETICON, ICON_SMALL2 as usize, small);
    // 部分场景任务栏读窗口类图标，同步一份并强制重绘非客户区。
    SetClassLongPtrW(hwnd.0 as _, GCLP_HICON, big);
    SetClassLongPtrW(hwnd.0 as _, GCLP_HICONSM, small);
    SetWindowPos(
      hwnd.0 as _,
      std::ptr::null_mut(),
      0,
      0,
      0,
      0,
      SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED,
    );
  }
  let previous_big = BIG_ICON.swap(big, Ordering::SeqCst);
  let previous_small = SMALL_ICON.swap(small, Ordering::SeqCst);
  unsafe {
    if previous_big != 0 {
      DestroyIcon(previous_big as _);
    }
    if previous_small != 0 && previous_small != previous_big {
      DestroyIcon(previous_small as _);
    }
  }
  Ok(())
}

/// 解析 .ico 的目录项：尺寸、数据偏移、数据长度。宽度字节 0 表示 256。
#[cfg(windows)]
fn ico_entries(ico: &[u8]) -> Result<Vec<(u32, usize, usize)>, String> {
  if ico.len() < 6 || u16::from_le_bytes([ico[4], ico[5]]) == 0 {
    return Err("ico 文件格式无效".into());
  }
  let count = u16::from_le_bytes([ico[4], ico[5]]) as usize;
  let mut images = Vec::with_capacity(count);
  for index in 0..count {
    let head = 6 + index * 16;
    if head + 16 > ico.len() {
      return Err("ico 目录越界".into());
    }
    let size = if ico[head] == 0 { 256 } else { ico[head] as u32 };
    let len = u32::from_le_bytes([ico[head + 8], ico[head + 9], ico[head + 10], ico[head + 11]]) as usize;
    let offset = u32::from_le_bytes([ico[head + 12], ico[head + 13], ico[head + 14], ico[head + 15]]) as usize;
    if offset + len > ico.len() {
      return Err("ico 数据越界".into());
    }
    images.push((size, offset, len));
  }
  Ok(images)
}

fn create_tray(
  app: &tauri::AppHandle,
  icon: tauri::image::Image<'static>,
  tooltip: &str,
) -> tauri::Result<TrayIcon> {
  let show_item = MenuItemBuilder::with_id("show", "显示 Lucky Apps").build(app)?;
  let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
  let menu = MenuBuilder::new(app).items(&[&show_item, &quit_item]).build()?;
  let mut builder = TrayIconBuilder::with_id("main")
    .icon(icon)
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
    });
  if !tooltip.is_empty() {
    builder = builder.tooltip(tooltip);
  }
  builder.build(app)
}

/// Windows 的溢出托盘会缓存 NIM_MODIFY 的图标；整块重建才能稳定换图。
fn replace_tray(app: &tauri::AppHandle, icon: tauri::image::Image<'static>, tooltip: &str) {
  let _ = app.remove_tray_by_id("main");
  match create_tray(app, icon, tooltip) {
    Ok(tray) => {
      if let Some(state) = app.try_state::<TrayProcess>() {
        *state.0.lock().unwrap() = Some(tray);
      }
    }
    Err(error) => eprintln!("[shell] 重建托盘图标失败: {error}"),
  }
}

fn apply_saved_branding(app: &tauri::AppHandle, window: &tauri::WebviewWindow) {
  let Ok(dir) = branding_dir(app) else { return };
  let Some(saved) = std::fs::read_to_string(dir.join("branding.json"))
    .ok()
    .and_then(|text| serde_json::from_str::<SavedBranding>(&text).ok())
  else {
    return;
  };
  // 安装包升级会换掉 exe，启动时按指纹补写一次，快捷方式/资源管理器才能看到品牌图标。
  #[cfg(windows)]
  {
    let needs_patch = std::env::current_exe()
      .ok()
      .and_then(|exe| file_hash(&exe))
      .map(|hash| hash != saved.exe_hash)
      .unwrap_or(false);
    if needs_patch {
      if let Ok(ico) = std::fs::read(dir.join("branding-icon.ico")) {
        let dir = dir.clone();
        let mut next = saved.clone();
        std::thread::spawn(move || {
          if patch_exe_icon(&ico).is_ok() {
            if let Ok(exe) = std::env::current_exe() {
              next.exe_hash = file_hash(&exe).unwrap_or(0);
            }
            if let Ok(json) = serde_json::to_string_pretty(&next) {
              let _ = std::fs::write(dir.join("branding.json"), format!("{json}\n"));
            }
          }
        });
      }
    }
  }
  if let Ok(rgba) = std::fs::read(dir.join("branding-icon.bin")) {
    if saved.width > 0 && saved.height > 0 {
      let image = tauri::image::Image::new_owned(rgba, saved.width, saved.height);
      let _ = window.set_icon(image.clone());
      replace_tray(app, image, &saved.name);
    }
  }
  #[cfg(windows)]
  if let Ok(ico) = std::fs::read(dir.join("branding-icon.ico")) {
    if let Err(error) = apply_taskbar_icon(window, &ico) {
      eprintln!("[shell] 恢复任务栏图标失败: {error}");
    }
  }
  if !saved.name.is_empty() {
    let _ = window.set_title(&saved.name);
    if let Some(tray) = tray_handle(app) {
      let _ = tray.set_tooltip(Some(saved.name.clone()));
    }
  }
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
  app.restart();
}

#[tauri::command]
async fn apply_branding(
  app: tauri::AppHandle,
  window: tauri::WebviewWindow,
  name: Option<String>,
  icon: Option<BrandingIcon>,
) -> Result<String, String> {
  let dir = branding_dir(&app)?;
  let mut saved = std::fs::read_to_string(dir.join("branding.json"))
    .ok()
    .and_then(|text| serde_json::from_str::<SavedBranding>(&text).ok())
    .unwrap_or_default();

  if let Some(name) = name.as_deref().map(str::trim).filter(|n| !n.is_empty()) {
    saved.name = name.to_string();
  }
  #[allow(unused_mut)]
  let mut taskbar_error: Option<String> = None;
  if let Some(icon) = &icon {
    let image = tauri::image::Image::new_owned(icon.rgba.clone(), icon.width, icon.height);
    window.set_icon(image.clone()).map_err(|e| e.to_string())?;
    replace_tray(&app, image, &saved.name);
    #[cfg(windows)]
    if !icon.ico.is_empty() {
      if let Err(error) = apply_taskbar_icon(&window, &icon.ico) {
        eprintln!("[shell] 任务栏图标更新失败: {error}");
        taskbar_error = Some(error);
      }
    }
    std::fs::write(dir.join("branding-icon.bin"), &icon.rgba).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("branding-icon.ico"), &icon.ico).map_err(|e| e.to_string())?;
    saved.width = icon.width;
    saved.height = icon.height;
  }
  if !saved.name.is_empty() {
    let _ = window.set_title(&saved.name);
    if let Some(tray) = tray_handle(&app) {
      let _ = tray.set_tooltip(Some(saved.name.clone()));
    }
  }

  let mut message = String::from("程序名称与窗口、托盘、任务栏图标已更新");
  #[cfg(windows)]
  if let Some(error) = taskbar_error {
    message.push_str(&format!("（任务栏图标未更新：{error}）"));
  }
  #[cfg(windows)]
  if let Some(icon) = icon.filter(|icon| !icon.ico.is_empty()) {
    if cfg!(debug_assertions) {
      message.push_str("（开发模式不修改 exe 文件图标）");
    } else {
      let outcome = tauri::async_runtime::spawn_blocking(move || patch_exe_icon(&icon.ico))
        .await
        .map_err(|e| e.to_string())?;
      match outcome {
        Ok(()) => {
          if let Ok(exe) = std::env::current_exe() {
            saved.exe_hash = file_hash(&exe).unwrap_or(0);
          }
          message.push_str("，exe 文件图标已写入（任务管理器里的进程图标需完全退出并重启应用后才更新）");
        }
        Err(error) => {
          eprintln!("[shell] exe 文件图标更新失败: {error}");
          message.push_str(&format!("（exe 文件图标未修改：{error}）"));
        }
      }
    }
  }

  let json = serde_json::to_string_pretty(&saved).map_err(|e| e.to_string())?;
  std::fs::write(dir.join("branding.json"), format!("{json}\n")).map_err(|e| e.to_string())?;
  Ok(message)
}

/// 把新图标写进 exe 文件资源。运行中的 exe 不能直接改写，
/// 经典做法：复制一份 → 在副本上 UpdateResource → 把原文件改名让位 → 副本顶上。
#[cfg(windows)]
fn patch_exe_icon(ico: &[u8]) -> Result<(), String> {
  {
    static PATCH_LOCK: Mutex<()> = Mutex::new(());
    let _guard = PATCH_LOCK.lock().unwrap();

    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::LibraryLoader::{
      BeginUpdateResourceW, EndUpdateResourceW, UpdateResourceW,
    };
    use windows_sys::Win32::UI::Shell::{
      SHChangeNotify, SHCNF_IDLIST, SHCNF_PATHW, SHCNE_ASSOCCHANGED, SHCNE_UPDATEITEM,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{RT_GROUP_ICON, RT_ICON};

    let images = ico_entries(ico)?;
    let count = images.len();
    // RT_GROUP_ICON：同 ICONDIR 头 + 每项 14 字节（末尾 offset 换成资源 ID）
    let mut group = Vec::with_capacity(6 + count * 14);
    group.extend_from_slice(&ico[..6]);
    for index in 0..count {
      let head = 6 + index * 16;
      group.extend_from_slice(&ico[head..head + 12]);
      group.extend_from_slice(&((index + 1) as u16).to_le_bytes());
    }

    let exe = std::env::current_exe().map_err(|e| format!("无法定位当前程序: {e}"))?;
    // 双保险：若本次启动已经改过名（正在跑 .old 副本），直接提示重启
    let stem = exe.file_stem().and_then(|s| s.to_str()).unwrap_or_default();
    if stem.ends_with(".old") {
      return Err("本次启动已更新过 exe 图标，重启应用后可再次修改".into());
    }
    let staging = exe.with_extension("staging.exe");
    let previous = exe.with_extension("old.exe");
    let _ = std::fs::remove_file(&staging);
    std::fs::copy(&exe, &staging).map_err(|e| format!("复制程序文件失败: {e}"))?;

    let wide: Vec<u16> = staging.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    let handle = unsafe { BeginUpdateResourceW(wide.as_ptr(), 0) };
    if handle.is_null() {
      let _ = std::fs::remove_file(&staging);
      return Err("无法打开程序资源（可能被占用或无权限）".into());
    }
    let mut ok = true;
    for (index, (_, offset, len)) in images.iter().enumerate() {
      let data = &ico[*offset..*offset + *len];
      let result = unsafe {
        UpdateResourceW(
          handle,
          RT_ICON as _,
          (index + 1) as usize as _,
          0x0409,
          data.as_ptr() as *const core::ffi::c_void,
          data.len() as u32,
        )
      };
      if result == 0 {
        ok = false;
        break;
      }
    }
    // Tauri 的默认图标组是 IDI_APPLICATION（32512）。旧版本写到组 1，Windows
    // 仍可能读取 32512，导致 exe/任务管理器图标看起来没变。
    // 两个组都写入新图标；注意不能“删除不存在的组 1”，会让更新句柄直接失效。
    if ok {
      for group_id in [1usize, 32512] {
        let result = unsafe {
          UpdateResourceW(
            handle,
            RT_GROUP_ICON as _,
            group_id as _,
            0x0409,
            group.as_ptr() as *const core::ffi::c_void,
            group.len() as u32,
          )
        };
        if result == 0 {
          ok = false;
          break;
        }
      }
    }
    let committed = unsafe { EndUpdateResourceW(handle, if ok { 0 } else { 1 }) } != 0;
    if !ok || !committed {
      let _ = std::fs::remove_file(&staging);
      return Err("写入图标资源失败".into());
    }

    // .old.exe 可能正是当前运行中的旧镜像（启动时自动补写过一次），这时换一个备份名。
    let mut backup = previous.clone();
    if previous.exists() && std::fs::remove_file(&previous).is_err() {
      backup = exe.with_extension(format!("old-{}.exe", std::process::id()));
      let _ = std::fs::remove_file(&backup);
    }
    std::fs::rename(&exe, &backup).map_err(|e| format!("原程序改名失败: {e}"))?;
    if let Err(error) = std::fs::rename(&staging, &exe) {
      // 尽力恢复原名
      let _ = std::fs::rename(&backup, &exe);
      return Err(format!("新程序就位失败: {error}"));
    }
    // 让资源管理器重新读取这个 exe 的图标；任务管理器需要等应用重启后展示新图标。
    let exe_wide: Vec<u16> = exe.as_os_str().encode_wide().chain(std::iter::once(0)).collect();
    unsafe {
      SHChangeNotify(
        SHCNE_UPDATEITEM as i32,
        SHCNF_PATHW,
        exe_wide.as_ptr() as *const core::ffi::c_void,
        std::ptr::null(),
      );
      SHChangeNotify(SHCNE_ASSOCCHANGED as i32, SHCNF_IDLIST, std::ptr::null(), std::ptr::null());
    }
    Ok(())
  }
}

fn spawn_server(app: &tauri::AppHandle) -> Result<(Child, String), String> {
  let root = project_root(app);
  // 开发布局是 apps/server/dist；安装包历史上曾映射到 server/dist，两种都兼容。
  let server_script = [
    root.join("apps").join("server").join("dist").join("index.mjs"),
    root.join("server").join("dist").join("index.mjs"),
  ]
    .into_iter()
    .find(|path| path.is_file())
    .unwrap_or_else(|| root.join("apps").join("server").join("dist").join("index.mjs"));
  let app_data = strip_verbatim(app.path().app_data_dir().map_err(|e| e.to_string())?);
  let env_db = std::env::var("WR_DB_PATH").ok().map(PathBuf::from);
  let env_profile = std::env::var("WR_PROFILE_DIR").ok();
  if env_db.is_none() && env_profile.is_none() {
    if let Err(error) = migrate_legacy_data(&app_data) {
      eprintln!("[shell] 旧数据迁移失败: {error}");
    }
  }
  let has_env_db = env_db.is_some();
  let mut db_path = env_db.unwrap_or_else(|| app_data.join("lucky_apps.db"));
  // 只有没有显式指定数据库时才回退旧标识的数据；测试/多实例不能被旧库覆盖。
  if !has_env_db && !db_path.exists() {
    if let Some(legacy) = legacy_data_dir(&app_data) {
      if let Some(legacy_db) = ["week_report.db", "lucky_apps.db"]
        .iter()
        .map(|name| legacy.join(name))
        .find(|path| path.is_file())
      {
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
    .env("WR_DIST_DIR", if cfg!(debug_assertions) { root.join("apps").join("desktop").join("dist") } else { root.join("dist") })
    .env("WR_RESOURCES_DIR", root.join("resources"))
    .env("WR_BUNDLED_PROFILE_DIR", if cfg!(debug_assertions) { root.join("src-tauri").join("target").join("profile") } else { root.join("profile") })
    .env("WR_DB_PATH", &db_path)
    .env("WR_PARENT_PID", std::process::id().to_string())
    .env("WR_APP_EXE", std::env::current_exe().unwrap_or_default())
    .env("WR_PORT", "34115")
    // 父进程退出/崩溃时管道关闭，Node 服务随之退出。
    .stdin(Stdio::piped())
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
    // 插件也可能往 stdout 打印自己的 http:// 地址；只认宿主 ready 行。
    if let Some(found) = server_url_from_line(&line) {
      url = found;
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
    .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
      }
    }))
    .plugin(tauri_plugin_log::Builder::default().build())
    .setup(|app| {
      let server = spawn_server(app.handle());
      let (window_url, boot_error) = match server {
        Ok((child, url)) => {
          app.manage(ServerProcess(Mutex::new(Some(child))));
          (WebviewUrl::External(url.parse().map_err(|e| format!("无效的服务地址: {e}"))?), None)
        }
        Err(error) => {
          eprintln!("[shell] 启动 Node 服务失败: {error}");
          (WebviewUrl::App("boot-error.html".into()), Some(error))
        }
      };

      let window = WebviewWindowBuilder::new(app, "main", window_url)
      .title("Lucky Apps")
      .inner_size(1400.0, 800.0)
      .resizable(true)
      .devtools(cfg!(debug_assertions))
      .build()?;

      if let Some(error) = boot_error {
        let json = serde_json::to_string(&error).unwrap_or_else(|_| "\"Node.js 服务启动失败\"".into());
        let _ = window.eval(&format!(
          "window.__BOOT_ERROR__ = {json}; window.dispatchEvent(new Event('lucky-boot-error'));"
        ));
      }

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

      let tray = create_tray(
        app.handle(),
        app.default_window_icon().map(|icon| icon.clone().to_owned()).expect("window icon"),
        "",
      )?;
      app.manage(TrayProcess(Mutex::new(Some(tray))));

      apply_saved_branding(app.handle(), &window);

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![apply_branding, restart_app])
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app, event| {
    if let RunEvent::Exit = event {
      if let Some(state) = app.try_state::<ServerProcess>() {
        if let Some(mut child) = state.0.lock().unwrap().take() {
          let _ = child.kill();
          let _ = child.wait();
        }
      }
      if let Some(state) = app.try_state::<TrayProcess>() {
        state.0.lock().unwrap().take();
      }
    }
  });
}

#[cfg(test)]
mod tests {
  use super::server_url_from_line;

  #[test]
  fn ignores_plugin_urls_and_reads_server_ready() {
    assert_eq!(server_url_from_line("[some-plugin] local service http://127.0.0.1:38471"), None);
    assert_eq!(
      server_url_from_line("[server] ready http://127.0.0.1:34115 (profile: C:/x)").as_deref(),
      Some("http://127.0.0.1:34115")
    );
  }
}
