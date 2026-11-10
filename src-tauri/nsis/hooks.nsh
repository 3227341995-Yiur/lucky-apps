; 关闭到托盘后进程仍在运行，安装/卸载前必须结束旧进程，否则文件被占用。
!macro NSIS_HOOK_PREINSTALL
  DetailPrint "Closing running week-report..."
  nsExec::Exec 'taskkill /F /T /IM lucky-apps.exe'
  nsExec::Exec 'taskkill /F /T /IM week-report.exe'
  ; 旧安装目录里的 profile 不会被覆盖安装自动清理，先删掉避免留下上万个旧文件
  RMDir /r "$INSTDIR\profile"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Closing running week-report..."
  nsExec::Exec 'taskkill /F /T /IM lucky-apps.exe'
  nsExec::Exec 'taskkill /F /T /IM week-report.exe'
!macroend
