import * as path from 'path';
import { commands, Extension, extensions, window, workspace, WorkspaceConfiguration } from "vscode";
import { getVariableSubstitutedAssociations } from "./variableSubstitution";

export interface ScopeInfo {
  scope: "default" | "global" | "workspace" | "folder";
  configurationTarget: boolean;
}

let vmArgsCache;
let ignoreAutoCloseTags = false;
let ignoreVMArgs = false;
let oldXXXConfig: WorkspaceConfiguration = getXXXConfiguration();
let oldJavaConfig: WorkspaceConfiguration = getJavaConfiguration();

const restartButton = 'Restart Now';
const ignoreButton = 'Ignore'
const restartId = "workbench.action.reloadWindow";
export const IS_WORKSPACE_JDK_ALLOWED = "java.ls.isJdkAllowed";
export const IS_WORKSPACE_JDK_XXX_ALLOWED = "java.ls.isJdkXxxAllowed";
export const IS_WORKSPACE_VMARGS_XXX_ALLOWED = "java.ls.isVmargsXxxAllowed";
export const xxxServerVmargs = 'xxx.server.vmargs';

export function getXXXConfiguration(): WorkspaceConfiguration {
  return getXConfiguration("xxx")
}

export function getJavaConfiguration(): WorkspaceConfiguration {
  return getXConfiguration("java");
}

export function getXConfiguration(configName: string) {
  return workspace.getConfiguration(configName);
}

export function onConfigurationChange() {
  if(!ignoreVMArgs) {
    verifyVMArgs();
  }

  if(!ignoreAutoCloseTags) {
    verifyAutoClosing();
  }
}

export function subscribeJDKChangeConfiguration() {
  return workspace.onDidChangeConfiguration(params => {

    //handle "xxx.java.home" change
    if(params.affectsConfiguration("xxx")) {
      const newXXXConfig = getXXXConfiguration();
      if(hasPreferenceChanged(oldXXXConfig, newXXXConfig, "java.home")) { // checks "xxx.java.home", not "java.home"
        createReloadWindowMessage("`xxx.java.home` path has changed. Please restart VS Code.");
      }
      // update to newest version of config
      oldXXXConfig = newXXXConfig;
      return;
    }

    //handle "java.home" change
    if(oldXXXConfig.get("java.home") == null) { // if "xxx.java.home" exists, dont even look at "java.home"
      if(params.affectsConfiguration("java")) {
        const newJavaConfig = getJavaConfiguration();
        //don't need to handle reload message if redhat.java extension exists (it will handle it)
        const redhatJavaExtension: Extension<any> = extensions.getExtension("redhat.java");
        const isJavaExtensionActive: boolean = redhatJavaExtension != null && redhatJavaExtension.isActive;
        if(!isJavaExtensionActive && hasPreferenceChanged(oldJavaConfig, newJavaConfig, "home")) { // checks "java.home"
          createReloadWindowMessage("`java.home` path has changed. Please restart VS Code.");
        }
        oldJavaConfig = newJavaConfig;
      }
      return;
    }
  });
}

function hasPreferenceChanged(oldConfig: WorkspaceConfiguration, newConfig: WorkspaceConfiguration, preference: string) {
  return oldConfig.get(preference) != newConfig.get(preference);
}

function createReloadWindowMessage(message: string) : string{
  window.showWarningMessage(message, restartButton, ignoreButton).then((selection) => {
    if (restartButton === selection) {
      commands.executeCommand(restartId);
    }
  });

  return ignoreButton;
}

function verifyVMArgs() {
  let currentVMArgs = workspace.getConfiguration("xxx.server").get("vmargs");
  if(vmArgsCache != undefined) {
    if(vmArgsCache != currentVMArgs) {
      let selection = createReloadWindowMessage("XXX Language Server configuration changed, please restart VS Code.");
      if(selection == ignoreButton) {
        ignoreVMArgs = true;
      }
    }
  }
  else {
    vmArgsCache = currentVMArgs;
  }
}

function verifyAutoClosing() {
  let configXXX = workspace.getConfiguration();
  let closeTags = configXXX.get("xxx.completion.autoCloseTags");
  let closeBrackets = configXXX.get("[xxx]")["editor.autoClosingBrackets"];
  if (closeTags && closeBrackets != "never") {
    window.showWarningMessage(
      "The [xxx].editor.autoClosingBrackets setting conflicts with xxx.completion.autoCloseTags. It's recommended to disable it.",
      "Disable",
      ignoreButton).then((selection) => {
        if (selection == "Disable") {
          let scopeInfo : ScopeInfo = getScopeLevel("", "[xxx]");
          workspace.getConfiguration().update("[xxx]", { "editor.autoClosingBrackets": "never" }, scopeInfo.configurationTarget).then(
            () => console.log('[xxx].editor.autoClosingBrackets globally set to never'),
            (error) => console.log(error)
          );
        }
        else if(selection == "Ignore") {
          ignoreAutoCloseTags = true;
        }
      });
  }
}

function getScopeLevel(configurationKey : string, key : string) : ScopeInfo{
  let configXXX = workspace.getConfiguration(configurationKey);
  let result = configXXX.inspect(key);
  let scope, configurationTarget;
  if(result.workspaceFolderValue == undefined) {
    if(result.workspaceValue == undefined) {
      if(result.globalValue == undefined) {
        scope = "default"
        configurationTarget = true;
      }
      else {
        scope = "global";
        configurationTarget = true;
      }
    }
    else {
      scope = "workspace";
      configurationTarget = false;
    }
  }
  else {
    scope = "folder";
    configurationTarget = undefined;
  }
  let scopeInfo : ScopeInfo = {"scope": scope, "configurationTarget": configurationTarget};
  return scopeInfo;
}

export function getKey(prefix, storagePath, value) {
  const workspacePath = path.resolve(storagePath + '/jdt_ws');
  if (workspace.name !== undefined) {
    return `${prefix}::${workspacePath}::${value}`;
  }
  else {
    return `${prefix}::${value}`;
  }
}

export function getJavaagentFlag(vmargs) {
  const javaagent = '-javaagent:';
  const args = vmargs.split(" ");
  let agentFlag = null;
  for (const arg of args) {
    if (arg.startsWith(javaagent)) {
      agentFlag = arg.substring(javaagent.length);
      break;
    }
  }
  return agentFlag;
}

/**
 * Returns a json object with key 'xxx' and a json object value that
 * holds all xxx. settings.
 *
 * Returns: {
 *            'xxx': {...}
 *          }
 */
export function getXXXSettings(javaHome: string | undefined, logfile: string, externalXxxSettings: any): JSON {
  let configXXX = workspace.getConfiguration().get('xxx');
  let xxx;
  if (!configXXX) { //Set default preferences if not provided
    const defaultValue =
    {
      xxx: {
        trace: {
          server: 'verbose'
        },
        logs: {
          client: true
        },
        format: {
          enabled: true,
          splitAttributes: false
        },
        completion: {
          autoCloseTags: false
        }
      }
    }
    xxx = defaultValue;
  } else {
    let x = JSON.stringify(configXXX); //configXXX is not a JSON type
    xxx = { "xxx": JSON.parse(x) };
  }
  xxx['xxx']['logs']['file'] = logfile;
  xxx['xxx']['useCache'] = true;
  xxx['xxx']['java']['home'] = javaHome;
  xxx['xxx']['format']['trimFinalNewlines'] = workspace.getConfiguration('files').get('trimFinalNewlines', true);
  xxx['xxx']['format']['trimTrailingWhitespace'] = workspace.getConfiguration('files').get('trimTrailingWhitespace', false);
  xxx['xxx']['format']['insertFinalNewline'] = workspace.getConfiguration('files').get('insertFinalNewline', false);
  xxx['xxx']['telemetry'] = {
    enabled: workspace.getConfiguration('redhat.telemetry').get('enabled', false)
  };

  //applying externalXxxSettings to the xxxSettings
  externalXxxSettings.xxxCatalogs.forEach(catalog => {
    if (!xxx['xxx']['catalogs'].includes(catalog)) {
      xxx['xxx']['catalogs'].push(catalog);
    }
  })
  // Apply variable substitutions for file associations
  xxx['xxx']['fileAssociations'] = [...getVariableSubstitutedAssociations(xxx['xxx']['fileAssociations'])];

  return xxx;
}