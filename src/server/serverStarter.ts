import { commands, ConfigurationTarget, ExtensionContext, window } from "vscode";
import { Executable } from "vscode-languageclient/node";
import { getXXXConfiguration } from "../settings/settings";
import { Telemetry } from "../telemetry";
import { ABORTED_ERROR, prepareBinaryExecutable } from "./binary/binaryServerStarter";
import { prepareJavaExecutable } from "./java/javaServerStarter";
import { getOpenJDKDownloadLink, RequirementsData } from "./requirements";

/**
 * Returns the executable to use to launch LemMinX (the XXX Language Server)
 *
 * @param requirements the java information, or an empty object if there is no java
 * @param xxxJavaExtensions a list of all the java extension jars
 * @param context the extensions context
 * @throws if neither the binary nor the java version of the extension can be launched
 * @returns the executable to launch LemMinX with (the XXX language server)
 */
export async function prepareExecutable(
  requirements: RequirementsData,
  xxxJavaExtensions: string[],
  context: ExtensionContext): Promise<Executable> {

  const hasJava: boolean = requirements.java_home !== undefined;
  const hasExtensions: boolean = xxxJavaExtensions.length !== 0;
  const preferBinary: boolean = getXXXConfiguration().get("server.preferBinary", false);
  const silenceExtensionWarning: boolean = getXXXConfiguration().get("server.silenceExtensionWarning", false);

  const useBinary: boolean = (!hasJava) || (preferBinary && !hasExtensions);

  if (hasExtensions && !hasJava && !silenceExtensionWarning) {
    const DOWNLOAD_JAVA: string = 'Get Java';
    const CONFIGURE_JAVA: string = 'More Info';
    const DISABLE_WARNING: string = 'Disable Warning';
    window.showInformationMessage('Extensions to the XXX language server were detected, but no Java was found. '
      + 'In order to use these extensions, please install and configure a Java runtime (Java 8 or more recent).',
      DOWNLOAD_JAVA, CONFIGURE_JAVA, DISABLE_WARNING)
      .then((selection: string) => {
        if (selection === DOWNLOAD_JAVA) {
          Telemetry.sendTelemetry(Telemetry.OPEN_JAVA_DOWNLOAD_LINK_EVT).then(() => {
            commands.executeCommand('vscode.open', getOpenJDKDownloadLink());
          });
        } else if (selection === CONFIGURE_JAVA) {
          commands.executeCommand('xxx.open.docs', { page: 'Preferences.md', section: 'java-home' });
        } else if (selection === DISABLE_WARNING) {
          getXXXConfiguration().update('server.silenceExtensionWarning', true, ConfigurationTarget.Global);
        }
      });
  }

  if (useBinary) {
    return prepareBinaryExecutable(context)
      .catch((e) => {
        const javaServerMessage = hasJava ? 'Falling back to the Java server.' : 'Cannot start XXX language server, since Java is missing.';
        if (e === ABORTED_ERROR) {
          window.showWarningMessage(`${e.message}. ${javaServerMessage}`);
        } else {
          window.showErrorMessage(`${e}. ${javaServerMessage}`);
        }
        if (!hasJava) {
          throw new Error("Failed to launch binary XXX language server and no Java is installed");
        }
        return prepareJavaExecutable(context, requirements, xxxJavaExtensions);
      });
  }
  return prepareJavaExecutable(context, requirements, xxxJavaExtensions);
}
