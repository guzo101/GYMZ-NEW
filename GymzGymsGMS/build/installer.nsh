; Register gymz:// protocol so password reset links from Supabase email open the app
; Uses HKCU (per-user) so no admin elevation is required
!macro customInstall
  WriteRegStr HKCU "Software\Classes\gymz" "" "URL:Gymz Protocol"
  WriteRegStr HKCU "Software\Classes\gymz" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\gymz\shell\open\command" "" '"$INSTDIR\Gymz.exe" "%1"'
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Classes\gymz"
!macroend
