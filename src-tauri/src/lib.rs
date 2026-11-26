use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

use tauri::{
  tray::{MouseButton, TrayIcon, TrayIconBuilder, TrayIconEvent},
  Emitter, Manager, RunEvent, WindowEvent, WebviewUrl, WebviewWindowBuilder,
};

struct ServerProcess(Mutex<Option<Child>>);
struct TrayProcess(Mutex<Option<TrayIcon>>);

/// 自绘托盘菜单的位置状态：右键时记下光标，菜单渲染完再按内容高度重新定位。
struct TrayMenuState {
  cursor: Mutex<Option<tauri::PhysicalPosition<f64>>>,
  /// 刚显示时系统可能先把焦点还给别的窗口，这个时间窗内的失焦事件忽略掉。
  shown_at: Mutex<Option<Instant>>,
}

const TRAY_MENU_WIDTH: f64 = 280.0;
const TRAY_MENU_HEIGHT: f64 = 360.0;
const TRAY_MENU_MIN_HEIGHT: f64 = 96.0;
const TRAY_MENU_MAX_HEIGHT: f64 = 640.0;

fn focus_main_window(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}

/// 把菜单放在光标靠左上方（macOS 菜单在托盘下方）。
fn tray_menu_position(app: &tauri::AppHandle, size: tauri::PhysicalSize<u32>) -> tauri::PhysicalPosition<i32> {
  let cursor = app
    .try_state::<TrayMenuState>()
    .and_then(|state| *state.cursor.lock().unwrap());
  let Some(cursor) = cursor else {
    return tauri::PhysicalPosition::new(0, 0);
  };
  let mut x = cursor.x - size.width as f64 + 18.0;
  let mut y = if cfg!(target_os = "macos") {
    cursor.y + 12.0
  } else {
    cursor.y - size.height as f64 - 12.0
  };
  // 托盘可能在副屏，按光标所在显示器夹取边界，取不到再退回主屏。
  let monitor = app
    .monitor_from_point(cursor.x, cursor.y)
    .ok()
    .flatten()
    .or_else(|| app.primary_monitor().ok().flatten());
  if let Some(monitor) = monitor {
    let origin = monitor.position();
    let area = monitor.size();
    let max_x = (origin.x + area.width as i32) as f64 - size.width as f64 - 8.0;
    let max_y = (origin.y + area.height as i32) as f64 - size.height as f64 - 8.0;
    x = x.max(origin.x as f64 + 8.0).min(max_x.max(origin.x as f64 + 8.0));
    y = y.max(origin.y as f64 + 8.0).min(max_y.max(origin.y as f64 + 8.0));
  }
  tauri::PhysicalPosition::new(x.round() as i32, y.round() as i32)
}

fn show_tray_menu(app: &tauri::AppHandle) {
  let Some(window) = app.get_webview_window("tray-menu") else {
    eprintln!("[shell] 托盘菜单窗口不存在");
    return;
  };
  let size = window.outer_size().unwrap_or(tauri::PhysicalSize::new(
    TRAY_MENU_WIDTH as u32,
    TRAY_MENU_HEIGHT as u32,
  ));
  let _ = window.set_position(tray_menu_position(app, size));
  let _ = window.show();
  let _ = window.set_focus();
  if let Some(state) = app.try_state::<TrayMenuState>() {
    *state.shown_at.lock().unwrap() = Some(Instant::now());
  }
  // Windows 会拒绝后台进程抢前台焦点；窗口显示后再补一次聚焦。
  let app_handle = app.clone();
  std::thread::spawn(move || {
    std::thread::sleep(Duration::from_millis(150));
    if let Some(win) = app_handle.get_webview_window("tray-menu") {
      if win.is_visible().unwrap_or(false) {
        let _ = win.set_focus();
        if let Some(state) = app_handle.try_state::<TrayMenuState>() {
          *state.shown_at.lock().unwrap() = Some(Instant::now());
        }
      }
    }
  });
  // 主窗口持有插件注册表，由它把菜单模型推给托盘窗口。
  let _ = app.emit_to("main", "tray:menu-open", ());
}

fn create_tray_menu_window(app: &tauri::AppHandle, server_url: &str) -> tauri::Result<tauri::WebviewWindow> {
  let mut url = tauri::Url::parse(server_url).map_err(tauri::Error::InvalidUrl)?;
  url.set_path("/tray.html");
  url.set_query(None);
  url.set_fragment(None);
  let builder = WebviewWindowBuilder::new(app, "tray-menu", WebviewUrl::External(url))
    .title("")
    .inner_size(TRAY_MENU_WIDTH, TRAY_MENU_HEIGHT)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .closable(false)
    .visible(false);
  // macOS 的透明窗口需要 macos-private-api（上架 App Store 会受影响），那边用不透明菜单。
  #[cfg(not(target_os = "macos"))]
  let builder = builder.transparent(true);
  let window = builder.build()?;
  let win = window.clone();
  window.on_window_event(move |event| {
    if let WindowEvent::Focused(false) = event {
      // 刚弹出的前几百毫秒忽略失焦，避免菜单一闪就没。
      let recent = win
        .app_handle()
        .try_state::<TrayMenuState>()
        .map(|state| {
          let mut shown = state.shown_at.lock().unwrap();
          let recent = shown.map(|at| at.elapsed() < Duration::from_millis(600)).unwrap_or(false);
          if !recent {
            *shown = None;
          }
          recent
        })
        .unwrap_or(false);
      if !recent {
        let _ = win.hide();
      }
    }
  });
  Ok(window)
}

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
  let mut builder = TrayIconBuilder::with_id("main")
    .icon(icon)
    .show_menu_on_left_click(false)
    .on_tray_icon_event(|tray, event| match event {
      TrayIconEvent::Click { button: MouseButton::Left, .. } => {
        focus_main_window(tray.app_handle());
      }
      TrayIconEvent::Click { button: MouseButton::Right, position, .. } => {
        let app = tray.app_handle();
        if let Some(state) = app.try_state::<TrayMenuState>() {
          *state.cursor.lock().unwrap() = Some(position);
        }
        show_tray_menu(app);
      }
      _ => {}
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
  #[cfg(windows)]
  if let Ok(exe) = std::env::current_exe() {
    cleanup_old_binaries(&exe);
  }
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
        std::thread::spawn(move || {
          // 补写过程可能和用户保存品牌并发；每次写回前重新读取，只更新 exe_hash。
          let read_latest = || std::fs::read_to_string(dir.join("branding.json"))
            .ok()
            .and_then(|text| serde_json::from_str::<SavedBranding>(&text).ok())
            .unwrap_or_default();
          let latest = read_latest();
          if patch_exe_icon(&ico, &latest.name).is_ok() {
            let mut merged = read_latest();
            if let Ok(exe) = std::env::current_exe() {
              merged.exe_hash = file_hash(&exe).unwrap_or(0);
            }
            if let Ok(json) = serde_json::to_string_pretty(&merged) {
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
  // 走优雅退出，让 WebView 把 localStorage 落盘后再重启。
  app.request_restart();
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
  focus_main_window(&app);
}

/// 打开主窗口并直接拉起设置面板；走 eval 派发，避免再依赖一层事件权限。
#[tauri::command]
fn open_settings(app: tauri::AppHandle) {
  focus_main_window(&app);
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.eval("window.dispatchEvent(new Event('lucky:open-settings'))");
  }
}

#[tauri::command]
fn hide_tray_menu(app: tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("tray-menu") {
    let _ = window.hide();
  }
  if let Some(state) = app.try_state::<TrayMenuState>() {
    *state.shown_at.lock().unwrap() = None;
  }
}

/// 菜单窗口渲染完成后主动补一次聚焦，Windows 首次 show 时经常不给前台焦点。
#[tauri::command]
fn focus_tray_menu(app: tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("tray-menu") {
    if window.is_visible().unwrap_or(false) {
      let _ = window.set_focus();
      if let Some(state) = app.try_state::<TrayMenuState>() {
        *state.shown_at.lock().unwrap() = Some(Instant::now());
      }
    }
  }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
  app.exit(0);
}

/// 菜单内容尺寸由前端测量后回传；展开二级菜单时宽度一起变大，窗口向左扩。
#[tauri::command]
fn resize_tray_menu(app: tauri::AppHandle, width: Option<f64>, height: f64) {
  let height = height.clamp(TRAY_MENU_MIN_HEIGHT, TRAY_MENU_MAX_HEIGHT);
  let width = width
    .unwrap_or(TRAY_MENU_WIDTH)
    .clamp(TRAY_MENU_WIDTH, 720.0);
  if let Some(window) = app.get_webview_window("tray-menu") {
    let _ = window.set_size(tauri::LogicalSize::new(width, height));
    if let Ok(size) = window.outer_size() {
      let _ = window.set_position(tray_menu_position(&app, size));
    }
  }
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
    // 只改名字、不改图标时也要把快捷方式改名。
    #[cfg(windows)]
    if icon.is_none() {
      if let Ok(exe) = std::env::current_exe() {
        retarget_shortcuts(&exe, &saved.name);
      }
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
      let brand = saved.name.clone();
      let outcome = tauri::async_runtime::spawn_blocking(move || patch_exe_icon(&icon.ico, &brand))
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

/// 启动时清掉上一次改名留下的 backup exe；正在运行的镜像删不掉就跳过。
#[cfg(windows)]
fn cleanup_old_binaries(exe: &Path) {
  let Some(dir) = exe.parent() else { return };
  let Ok(entries) = std::fs::read_dir(dir) else { return };
  let running = std::fs::canonicalize(exe).ok();
  for entry in entries.flatten() {
    let path = entry.path();
    let Some(name) = path.file_name().and_then(|name| name.to_str()) else { continue };
    if !name.starts_with("lucky-apps.old") || !name.ends_with(".exe") {
      continue;
    }
    if std::fs::canonicalize(&path).ok() == running {
      continue;
    }
    let _ = std::fs::remove_file(&path);
  }
}

/// 固定到任务栏/开始菜单/桌面的快捷方式如果写死了旧图标，这里把它们改回 exe 图标。
#[cfg(windows)]
fn retarget_shortcuts(exe: &Path, brand: &str) {
  use std::os::windows::process::CommandExt;
  const SCRIPT: &str = r#"
$exe = $env:LUCKY_APP_EXE
$name = $env:LUCKY_APP_NAME
$safe = ($name -replace '[\\/:*?"<>|]', '_').Trim().TrimEnd('.')
if ([string]::IsNullOrWhiteSpace($safe)) { $safe = "Lucky Apps" }
Add-Type -Namespace Win -Name Shell -MemberDefinition '[DllImport("shell32.dll", CharSet=CharSet.Unicode)] public static extern void SHChangeNotify(int e, uint f, string a, IntPtr b);'
$sh = New-Object -ComObject WScript.Shell
$dirs = @(
  "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar",
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
  "$env:USERPROFILE\Desktop",
  "$env:PUBLIC\Desktop",
  "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
)
foreach ($dir in $dirs) {
  if (-not (Test-Path -LiteralPath $dir)) { continue }
  Get-ChildItem -LiteralPath $dir -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $link = $_
      $s = $sh.CreateShortcut($link.FullName)
      if ($s.TargetPath -and $s.TargetPath.Equals($exe, [StringComparison]::OrdinalIgnoreCase)) {
        $s.IconLocation = "$exe,0"
        $s.Save()
        [Win.Shell]::SHChangeNotify(0x2000, 5, $link.FullName, [IntPtr]::Zero)
        if ($link.BaseName -ne $safe) {
          $target = Join-Path $link.DirectoryName "$safe.lnk"
          if (-not (Test-Path -LiteralPath $target)) {
            Rename-Item -LiteralPath $link.FullName -NewName "$safe.lnk" -ErrorAction Stop
            [Win.Shell]::SHChangeNotify(0x2000, 5, $target, [IntPtr]::Zero)
          }
        }
      }
    } catch {}
  }
}
"#;
  let _ = std::process::Command::new("powershell.exe")
    .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", SCRIPT])
    .env("LUCKY_APP_EXE", exe)
    .env("LUCKY_APP_NAME", brand)
    .creation_flags(CREATE_NO_WINDOW)
    .status();
}

/// 把新图标写进 exe 文件资源。运行中的 exe 不能直接改写，
/// 经典做法：复制一份 → 在副本上 UpdateResource → 把原文件改名让位 → 副本顶上。
#[cfg(windows)]
fn patch_exe_icon(ico: &[u8], brand: &str) -> Result<(), String> {
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
    retarget_shortcuts(&exe, brand);
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
      app.manage(TrayMenuState {
        cursor: Mutex::new(None),
        shown_at: Mutex::new(None),
      });
      let server = spawn_server(app.handle());
      let (window_url, boot_error, server_url) = match server {
        Ok((child, url)) => {
          app.manage(ServerProcess(Mutex::new(Some(child))));
          let parsed = url.parse().map_err(|e| format!("无效的服务地址: {e}"))?;
          (WebviewUrl::External(parsed), None, Some(url))
        }
        Err(error) => {
          eprintln!("[shell] 启动 Node 服务失败: {error}");
          (WebviewUrl::App("boot-error.html".into()), Some(error), None)
        }
      };

      let window = WebviewWindowBuilder::new(app, "main", window_url)
      .title("Lucky Apps")
      .inner_size(1400.0, 800.0)
      .resizable(true)
      .decorations(false)
      .devtools(cfg!(debug_assertions))
      .build()?;

      // 自绘托盘菜单和主窗口用同一个前端服务，插件通过主窗口注册菜单项。
      if let Some(url) = server_url {
        if let Err(error) = create_tray_menu_window(app.handle(), &url) {
          eprintln!("[shell] 创建托盘菜单窗口失败: {error}");
        }
      }

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
    .invoke_handler(tauri::generate_handler![
      apply_branding,
      restart_app,
      show_main_window,
      open_settings,
      hide_tray_menu,
      focus_tray_menu,
      resize_tray_menu,
      quit_app
    ])
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
