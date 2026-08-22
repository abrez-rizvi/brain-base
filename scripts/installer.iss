; Inno Setup Script for Ever-Brain CLI
#define MyAppName "EverBrain"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Ever-Brain"
#define MyAppURL "https://github.com/abrez-rizvi/ever-brain"
#define MyAppExeName "ever-brain.exe"

[Setup]
AppId={{D37D6E2C-9F62-4C9D-9F36-F173516E49E0}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=EverBrainSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ChangesEnvironment=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\bin\ever-brain.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\bin\ever-brain.exe"; DestName: "evb.exe"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
; Add application directory to user PATH
Root: HKCU; Subkey: "Environment"; ValueType: expandsz; ValueName: "Path"; ValueData: "{olddata};{app}"; Check: NeedsAddPath(ExpandConstant('{app}'))

[Code]
function NeedsAddPath(Param: string): boolean;
var
  OrigPath: string;
begin
  if not RegQueryStringValue(HKEY_CURRENT_USER, 'Environment', 'Path', OrigPath)
  then begin
    Result := True;
    exit;
  end;
  Result := Pos(';' + Param + ';', ';' + OrigPath + ';') = 0;
end;
