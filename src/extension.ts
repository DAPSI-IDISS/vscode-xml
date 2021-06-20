/**
 *  Copyright (c) 2018 Red Hat, Inc. and others.
 *  All rights reserved. This program and the accompanying materials
 *  are made available under the terms of the Eclipse Public License v2.0
 *  which accompanies this distribution, and is available at
 *  https://www.eclipse.org/legal/epl-v20.html
 *
 *  Contributors:
 *  Red Hat Inc. - initial API and implementation
 *  Microsoft Corporation - Auto Closing Tags
 */

import * as os from 'os';
import * as path from 'path';
import { ExtensionContext, extensions, languages } from "vscode";
import { Executable, LanguageClient } from 'vscode-languageclient/node';
import { XXXExtensionApi } from './api/xmlExtensionApi';
import { getXxxExtensionApiImplementation } from './api/xmlExtensionApiImplementation';
import { getIndentationRules } from './client/indentation';
import { startLanguageClient } from './client/xmlClient';
import { collectXxxJavaExtensions } from './plugin';
import * as requirements from './server/requirements';
import { prepareExecutable } from './server/serverStarter';
import { ExternalXxxSettings } from "./settings/externalXmlSettings";
import { getXXXConfiguration } from './settings/settings';
import { Telemetry } from './telemetry';

let languageClient: LanguageClient;

export async function activate(context: ExtensionContext): Promise<XXXExtensionApi> {

  await Telemetry.startTelemetry();
  Telemetry.sendTelemetry(Telemetry.SETTINGS_EVT, {
    preferBinary: (getXXXConfiguration()['server']['preferBinary'] as boolean)
  });

  languages.setLanguageConfiguration('xxx', getIndentationRules());

  let requirementsData: requirements.RequirementsData;
  try {
    requirementsData = await requirements.resolveRequirements(context);
  } catch (error) {
    requirementsData = {} as requirements.RequirementsData;
  }

  let storagePath: string = context.storagePath;
  if (!storagePath) {
    storagePath = os.homedir() + "/.lemminx";
  }
  const logfile = path.resolve(storagePath + '/lemminx.log');

  const externalXxxSettings: ExternalXxxSettings = new ExternalXxxSettings();

  const serverOptions: Executable = await prepareExecutable(
    requirementsData, collectXxxJavaExtensions(extensions.all, getXXXConfiguration().get("extension.jars", [])), context);

  languageClient = await startLanguageClient(context, serverOptions, logfile, externalXxxSettings, requirementsData);

  return getXxxExtensionApiImplementation(languageClient, logfile, externalXxxSettings, requirementsData);
}

export async function deactivate(): Promise<void> {
  if (languageClient) {
    await languageClient.stop();
  }
}
