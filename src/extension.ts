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
 *  DAPSI IDISS - Semantic Crosswalk Extensions
 */

import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { ExtensionContext, extensions, languages } from "vscode";
import { Executable, LanguageClient } from 'vscode-languageclient/node';
import { XMLExtensionApi } from './api/xmlExtensionApi';
import { getXmlExtensionApiImplementation } from './api/xmlExtensionApiImplementation';
import { cleanUpHeapDumps } from './client/clientErrorHandler';
import { getIndentationRules } from './client/indentation';
import { startLanguageClient } from './client/xmlClient';
import { registerClientOnlyCommands } from './commands/registerCommands';
import { collectXmlJavaExtensions } from './plugin';
import * as requirements from './server/requirements';
import { prepareExecutable } from './server/serverStarter';
import { ExternalXmlSettings } from "./settings/externalXmlSettings";
import { getXMLConfiguration } from './settings/settings';
import { Telemetry } from './telemetry';
// DAPSI additions
import * as vscode from 'vscode'; // TODO: Fix imports to only require the ones we use
import { commands, window } from "vscode";
import { ExperimentalView } from './experimentalView';
import { SemanticView } from './semanticView';
import { XMLView } from './xmlView';

let languageClient: LanguageClient;

export async function activate(context: ExtensionContext): Promise<XMLExtensionApi> {

  await Telemetry.startTelemetry(context);
  Telemetry.sendTelemetry(Telemetry.SETTINGS_EVT, {
    preferBinary: (getXMLConfiguration()['server']['preferBinary'] as boolean)
  });

  registerClientOnlyCommands(context);

  languages.setLanguageConfiguration('xml', getIndentationRules());
  languages.setLanguageConfiguration('xsl', getIndentationRules());

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
  await fs.ensureDir(context.globalStorageUri.fsPath);
  await cleanUpHeapDumps(context);

  const externalXmlSettings: ExternalXmlSettings = new ExternalXmlSettings();

  const serverOptions: Executable = await prepareExecutable(
    requirementsData, collectXmlJavaExtensions(extensions.all, getXMLConfiguration().get("extension.jars", [])), context);

  languageClient = await startLanguageClient(context, serverOptions, logfile, externalXmlSettings, requirementsData);

  // <-- DAPSI addition start
  new SemanticView(context);

  // Register decoration
  const decorationProvider = new DecorationProvider();
  vscode.window.registerFileDecorationProvider(decorationProvider);

  const experimentalViewProvider = new ExperimentalView(context.extensionUri);

  // Part below should be probably moved to registerCommands.ts
  context.subscriptions.push(
    window.registerWebviewViewProvider(ExperimentalView.viewType, experimentalViewProvider));

  context.subscriptions.push(
    commands.registerCommand('experimentalView.addSnippet', () => {
      experimentalViewProvider.addSnippet();
    }));

  context.subscriptions.push(
    commands.registerCommand('experimentalView.clearSnippets', () => {
      experimentalViewProvider.clearSnippets();
    }));
  // -- DAPSI addition end -->

  return getXmlExtensionApiImplementation(languageClient, logfile, externalXmlSettings, requirementsData);
}

export async function deactivate(): Promise<void> {
  if (languageClient) {
    await languageClient.stop();
  }
}


const getNumberOfSearchItemOccurrence = (editor: vscode.TextEditor | undefined, searchItem: string): number => {
  let matches = 0;
  if (editor) {
    const query = new RegExp(searchItem, 'g');
    matches = (editor.document.getText().match(query) || []).length;
  }

  return matches;
}

// Git-like badges (badge API?) seems to be not exposed yet - https://github.com/Microsoft/vscode/issues/62783 (Workaround: Showing a number in the Tree View Title or Description per view, and via DecorationProvider per node is possible)
// Following is just a test to add a "fake badge" to Tree View node labels and pass counts retrieved from here to the node's tooltip
class DecorationProvider implements vscode.FileDecorationProvider {
  public provideDecoratorPerScheme = (uri: vscode.Uri, color?: vscode.ThemeColor) => {
    const count = getNumberOfSearchItemOccurrence(vscode.window.activeTextEditor, uri.path);
    return {
      badge: `${count > 99 ? '∞' : count}`, // Seems to be limited to a string length of 2 ... alternatives could be 'GT' or '>' = Greater Than, '‰' per mile (per thousand?) '∞' infinite (of course not the correct meaning but 99+ can be infinite)
      // debugTokenExpression.boolean = semantic blue ... debugTokenExpression.string = path value red ... couldn't figure out the "real" color definition used for the Syntax Highlighting yet
      color, 
      tooltip: `${count} result(s) in current file`,
    };
  }

  onDidChangeFileDecorations?: vscode.Event<vscode.Uri | vscode.Uri[] | undefined>;
  provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {
    // Apply different decorators per view "uri.scheme"
    if(uri.scheme === 'semanticView') {
      return this.provideDecoratorPerScheme(uri);
    }
  }
}
