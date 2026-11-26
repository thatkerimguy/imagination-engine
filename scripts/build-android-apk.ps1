<#
.SYNOPSIS
  Builds the Kinetic Writer Android APK locally with Gradle (no EAS) and optionally installs it.

.DESCRIPTION
  Idempotent. Checks JDK 17, the Android SDK (platform-tools, platforms;android-35,
  build-tools;35.0.0), builds the offline reader preview bundle, runs `expo prebuild`, signs
  release builds with a git-ignored local keystore, runs Gradle, copies the APK to
  apps/writer/dist/kinetic-writer.apk and (optionally) installs it with adb.
  Environment changes (JAVA_HOME, ANDROID_HOME, PATH) apply to this process only.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/build-android-apk.ps1 -InstallTools -Install

.EXAMPLE
  # Fast rebuild for a single 64-bit ARM phone (e.g. Redmi Note 12): one ABI, smaller APK.
  powershell -ExecutionPolicy Bypass -File scripts/build-android-apk.ps1 -Abi arm64-v8a -Install
#>
[CmdletBinding()]
param(
  [ValidateSet('release', 'debug')] [string] $Variant = 'release',
  # Build one ABI only (e.g. arm64-v8a for a fast phone rebuild). Default 'all' = universal APK.
  [ValidateSet('all', 'arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86')] [string] $Abi = 'all',
  # Install missing JDK 17 (winget) and Android command-line tools + SDK packages.
  [switch] $InstallTools,
  # Also install Android Studio through winget (not needed to build).
  [switch] $WithAndroidStudio,
  # adb install -r the APK (also happens automatically when exactly one device is attached).
  [switch] $Install,
  # Reuse an existing apps/writer/android project instead of `expo prebuild --clean`.
  [switch] $SkipPrebuild,
  # Only check / install JDK 17 and the Android SDK, then stop.
  [switch] $ToolsOnly
)
$ErrorActionPreference = 'Stop'
$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$Writer = Join-Path $Root 'apps\writer'
$AndroidDir = Join-Path $Writer 'android'
$KeyDir = Join-Path $Writer '.keystore'
$Dist = Join-Path $Writer 'dist'
$CmdlineToolsUrl = 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip'
$SdkPackages = @('platform-tools', 'platforms;android-35', 'build-tools;35.0.0')

function Write-Step([string] $Text) { Write-Host "`n==> $Text" -ForegroundColor Cyan }
function Fail([string] $Text) { Write-Host "ERROR: $Text" -ForegroundColor Red; exit 1 }
function Invoke-Checked([string] $What, [scriptblock] $Block) {
  & $Block
  if ($LASTEXITCODE -ne 0) { Fail "$What failed (exit $LASTEXITCODE)." }
}

# ── JDK 17 ──────────────────────────────────────────────────────────────────────────────────
function Get-JdkMajor([string] $JavaHome) {
  $java = Join-Path $JavaHome 'bin\java.exe'
  if (-not (Test-Path $java) -or -not (Test-Path (Join-Path $JavaHome 'bin\javac.exe'))) { return 0 }
  $line = (& cmd /c "`"$java`" -version 2>&1") | Select-Object -First 1
  if ("$line" -match 'version "(\d+)') { return [int] $Matches[1] }
  return 0
}

function Find-Jdk17 {
  $candidates = @()
  if ($env:JAVA_HOME) { $candidates += $env:JAVA_HOME }
  foreach ($base in @("$env:ProgramFiles\Eclipse Adoptium", "$env:ProgramFiles\Java",
      "$env:ProgramFiles\Microsoft", "$env:ProgramFiles\Zulu", "$env:ProgramFiles\Android\Android Studio")) {
    if (Test-Path $base) {
      $candidates += Get-ChildItem $base -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match 'jdk-?17|jbr|zulu-?17' } | ForEach-Object FullName
    }
  }
  foreach ($c in $candidates) { if ((Get-JdkMajor $c) -eq 17) { return $c } }
  return $null
}

Write-Step 'Checking JDK 17'
$Jdk = Find-Jdk17
if (-not $Jdk -and $InstallTools) {
  Write-Host 'Installing Eclipse Temurin JDK 17 via winget...'
  & winget install --id EclipseAdoptium.Temurin.17.JDK -e --silent --accept-source-agreements --accept-package-agreements
  $Jdk = Find-Jdk17
}
if (-not $Jdk) { Fail 'JDK 17 not found. Re-run with -InstallTools, or install Temurin 17 and set JAVA_HOME.' }
$env:JAVA_HOME = $Jdk
$env:PATH = "$Jdk\bin;$env:PATH"
Write-Host "JDK 17: $Jdk"

# ── Android SDK ─────────────────────────────────────────────────────────────────────────────
Write-Step 'Checking Android SDK'
$Sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } elseif ($env:ANDROID_SDK_ROOT) { $env:ANDROID_SDK_ROOT } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$SdkManager = Join-Path $Sdk 'cmdline-tools\latest\bin\sdkmanager.bat'

if ($WithAndroidStudio -and -not (Test-Path "$env:ProgramFiles\Android\Android Studio")) {
  Write-Host 'Installing Android Studio via winget...'
  & winget install --id Google.AndroidStudio -e --silent --accept-source-agreements --accept-package-agreements
}
$missing = $SdkPackages | Where-Object { -not (Test-Path (Join-Path $Sdk ($_ -replace ';', '\'))) }
# sdkmanager is only needed to install missing packages (Android Studio's cmdline-tools 19+ may
# ship without sdkmanager.bat; a complete SDK must not be overwritten just to satisfy this check).
if ($missing -and -not (Test-Path $SdkManager)) {
  if (-not $InstallTools) { Fail "Missing SDK packages ($($missing -join ', ')) and no sdkmanager under $Sdk. Re-run with -InstallTools." }
  Write-Host "Installing Android command-line tools into $Sdk ..."
  $zip = Join-Path $env:TEMP 'android-cmdline-tools.zip'
  $tmp = Join-Path $env:TEMP 'android-cmdline-tools'
  Invoke-WebRequest -Uri $CmdlineToolsUrl -OutFile $zip -UseBasicParsing
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive $zip -DestinationPath $tmp -Force
  New-Item -ItemType Directory -Force (Join-Path $Sdk 'cmdline-tools') | Out-Null
  $latest = Join-Path $Sdk 'cmdline-tools\latest'
  if (Test-Path $latest) { Remove-Item $latest -Recurse -Force }
  Move-Item (Join-Path $tmp 'cmdline-tools') $latest
  Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
$env:ANDROID_HOME = $Sdk
$env:ANDROID_SDK_ROOT = $Sdk
$env:PATH = "$Sdk\platform-tools;$Sdk\cmdline-tools\latest\bin;$env:PATH"

$missing = $SdkPackages | Where-Object { -not (Test-Path (Join-Path $Sdk ($_ -replace ';', '\'))) }
if ($missing) {
  if (-not $InstallTools) { Fail "Missing SDK packages: $($missing -join ', '). Re-run with -InstallTools." }
  Write-Host "Accepting SDK licenses and installing: $($missing -join ', ')"
  # sdkmanager asks y/N once per license. Neither a PowerShell pipe nor a cmd pipe reaches the
  # .bat's java reliably; a stdin redirect from a file of answers does.
  $yes = Join-Path $env:TEMP 'kn-sdk-yes.txt'
  Set-Content $yes -Encoding ASCII -Value (1..60 | ForEach-Object { 'y' })
  & cmd /c "`"$SdkManager`" --sdk_root=`"$Sdk`" --licenses < `"$yes`"" | Out-Null
  Remove-Item $yes -ErrorAction SilentlyContinue
  Invoke-Checked 'sdkmanager install' { & $SdkManager --sdk_root="$Sdk" @missing }
  $missing = $SdkPackages | Where-Object { -not (Test-Path (Join-Path $Sdk ($_ -replace ';', '\'))) }
  if ($missing) { Fail "SDK packages still missing after install: $($missing -join ', ')" }
}
Write-Host "Android SDK: $Sdk"
if ($ToolsOnly) { Write-Step 'Toolchain ready (-ToolsOnly).'; exit 0 }

# ── Offline preview bundle + prebuild ───────────────────────────────────────────────────────
Push-Location $Root
try {
  Write-Step 'Building the built-in offline reader (pnpm build:preview-bundle)'
  Invoke-Checked 'build:preview-bundle' { & pnpm build:preview-bundle }

  if (-not $SkipPrebuild -or -not (Test-Path $AndroidDir)) {
    Write-Step 'Generating the Android Gradle project (expo prebuild --clean)'
    $env:CI = '1'
    $env:EXPO_NO_GIT_STATUS = '1'
    Invoke-Checked 'expo prebuild' { & pnpm --filter '@kn/writer' exec expo prebuild --platform android --clean }
  }
  Set-Content -Path (Join-Path $AndroidDir 'local.properties') -Encoding ASCII `
    -Value ('sdk.dir=' + ($Sdk -replace '\\', '\\' -replace ':', '\:'))

  # ── Short native build dirs (Windows MAX_PATH) ───────────────────────────────────────────
  # pnpm keeps packages under node_modules\.pnpm\<name>@<hash>\..., so each native module's
  # default CMake dir (android\.cxx) passes 260 chars and ninja loops on "build.ninja still
  # dirty". Stage every module's CMake build under %SystemDrive%\knx\<module> instead: React
  # Native codegen nests very long folder names, so even hashed object paths need a short root.
  $cxxRoot = "$env:SystemDrive/knx"
  $rootGradle = Join-Path $AndroidDir 'build.gradle'
  $gradleText = Get-Content $rootGradle -Raw
  if ($gradleText -notmatch 'knShortCxx v4') {
    # Drop an older version of the block before inserting the current one.
    $gradleText = [regex]::Replace($gradleText, '(?s)// Added by scripts/build-android-apk\.ps1 \(knShortCxx.*?(?=apply plugin: "expo-root-project")', '')
    # Must run before `expo-root-project`, which evaluates some modules as soon as it is applied.
    $block = @"
// Added by scripts/build-android-apk.ps1 (knShortCxx v4): keep CMake paths under Windows MAX_PATH.
// Short staging dirs, and CMAKE_OBJECT_PATH_MAX makes CMake hash object paths that would grow
// past it (sources live deep under node_modules\.pnpm and are mirrored into CMakeFiles).
subprojects { sub ->
    ['com.android.library', 'com.android.application'].each { id ->
        sub.plugins.withId(id) {
            try {
                sub.android.externalNativeBuild.cmake.buildStagingDirectory = new File('$cxxRoot/' + sub.name)
                sub.android.defaultConfig.externalNativeBuild.cmake.arguments('-DCMAKE_OBJECT_PATH_MAX=250')
            } catch (Exception e) {
                logger.warn("knShortCxx: kept default CMake dir for `${sub.name}: `${e.message}")
            }
        }
    }
}

"@
    $anchor = 'apply plugin: "expo-root-project"'
    if ($gradleText -notmatch [regex]::Escape($anchor)) { Fail "Unexpected $rootGradle layout (no $anchor)." }
    $gradleText = $gradleText.Replace($anchor, $block + $anchor)
    [System.IO.File]::WriteAllText($rootGradle, $gradleText)
  }
  Get-ChildItem (Join-Path $Root 'node_modules\.pnpm') -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Get-ChildItem $_.FullName -Filter '.cxx' -Recurse -Directory -Depth 4 -ErrorAction SilentlyContinue } |
    Where-Object { $_.Parent.Name -eq 'android' } |
    ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }

  # ── Local release signing (git-ignored keystore) ─────────────────────────────────────────
  if ($Variant -eq 'release') {
    Write-Step 'Wiring local release signing'
    $jks = Join-Path $KeyDir 'local-release.jks'
    $props = Join-Path $KeyDir 'local-release.properties'
    if (-not (Test-Path $jks) -or -not (Test-Path $props)) {
      New-Item -ItemType Directory -Force $KeyDir | Out-Null
      $pass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char] $_ })
      Invoke-Checked 'keytool' {
        & (Join-Path $Jdk 'bin\keytool.exe') -genkeypair -storetype PKCS12 -keystore $jks `
          -alias kinetic-local -keyalg RSA -keysize 2048 -validity 10000 `
          -storepass $pass -keypass $pass -dname 'CN=Kinetic Writer (local), O=Local build'
      }
      Set-Content -Path $props -Encoding ASCII -Value @("storePassword=$pass", 'keyAlias=kinetic-local')
      Write-Host "Created local keystore $jks (keep it: updates must be signed with the same key)."
    }
    $gradleFile = Join-Path $AndroidDir 'app\build.gradle'
    $gradle = Get-Content $gradleFile -Raw
    if ($gradle -notmatch 'knLocalRelease') {
      $jksPath = $jks -replace '\\', '/'
      $propsPath = $props -replace '\\', '/'
      Add-Content -Path $gradleFile -Encoding ASCII -Value @"

// Added by scripts/build-android-apk.ps1: sign release builds with the local, git-ignored keystore.
def knKeyProps = new Properties()
file('$propsPath').withInputStream { knKeyProps.load(it) }
android.signingConfigs {
    knLocalRelease {
        storeFile file('$jksPath')
        storePassword knKeyProps['storePassword']
        keyAlias knKeyProps['keyAlias']
        keyPassword knKeyProps['storePassword']
    }
}
android.buildTypes.release.signingConfig = android.signingConfigs.knLocalRelease
"@
    }
  }

  # ── Gradle ───────────────────────────────────────────────────────────────────────────────
  $task = if ($Variant -eq 'release') { 'assembleRelease' } else { 'assembleDebug' }
  $gradleArgs = @($task, '--no-daemon')
  if ($Abi -ne 'all') { $gradleArgs += "-PreactNativeArchitectures=$Abi" }
  $abiLabel = if ($Abi -eq 'all') { 'all ABIs (universal)' } else { "$Abi only" }
  Write-Step "Running gradlew $task for $abiLabel (first run downloads Gradle, the NDK and dependencies)"
  Push-Location $AndroidDir
  try { Invoke-Checked "gradlew $task" { & .\gradlew.bat @gradleArgs } }
  finally { Pop-Location }

  $built = Join-Path $AndroidDir "app\build\outputs\apk\$Variant\app-$Variant.apk"
  if (-not (Test-Path $built)) { Fail "Gradle finished but $built is missing." }
  New-Item -ItemType Directory -Force $Dist | Out-Null
  $apk = Join-Path $Dist 'kinetic-writer.apk'
  Copy-Item $built $apk -Force
  $size = '{0:N1} MB' -f ((Get-Item $apk).Length / 1MB)
  Write-Step "APK ready: $apk ($size, $Variant, $abiLabel)"

  # ── Install ──────────────────────────────────────────────────────────────────────────────
  $adb = (Get-Command adb -ErrorAction SilentlyContinue).Source
  if (-not $adb) { Write-Host 'adb not found; copy the APK to the phone to install it.'; exit 0 }
  $devices = @(& $adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\tdevice$' })
  if ($Install -or $devices.Count -eq 1) {
    if ($devices.Count -eq 0) { Write-Host 'No adb device attached (enable USB debugging and retry with -Install).'; exit 0 }
    if ($devices.Count -gt 1) { Fail 'More than one adb device attached; set ANDROID_SERIAL to choose one.' }
    Write-Step "Installing on $(($devices[0] -split "`t")[0])"
    Invoke-Checked 'adb install' { & $adb install -r $apk }
    Write-Host 'Installed. Open "Kinetic Writer" on the phone.'
  }
}
finally { Pop-Location }
