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
// DAPSI additions
let idissStatusBarItem: vscode.StatusBarItem;

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
  new XMLView(context);

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

  context.subscriptions.push(
    languages.registerDocumentSymbolProvider(
      {scheme: "file", language: "xml"}, 
      new SyntaxBindingDocumentSymbolProvider())
  );

  // Register a command that is invoked when the status bar item is selected
  const statusMessageCommand = 'idiss.showSelectionCount';
  context.subscriptions.push(vscode.commands.registerCommand(statusMessageCommand, () => {
    const semanticsCount = getNumberFromSemanticsAttribute(vscode.window.activeTextEditor, 'semantic-nodes');
    const xmlCount = getNumberFromSemanticsAttribute(vscode.window.activeTextEditor, 'syntax-nodes');
    vscode.window.showInformationMessage(`${semanticsCount} Semantic(s) found, ${xmlCount} XML Bindings(s) found`);
  }));

  // Create a new status bar item that we can now manage
  idissStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  idissStatusBarItem.command = statusMessageCommand;
  context.subscriptions.push(idissStatusBarItem);

  // Register some listener that make sure the status bar item is always up-to-date
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem));
  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem));

  // Update status bar item once at start
  updateStatusBarItem();

  // -- DAPSI addition end -->

  return getXmlExtensionApiImplementation(languageClient, logfile, externalXmlSettings, requirementsData);
}

export async function deactivate(): Promise<void> {
  if (languageClient) {
    await languageClient.stop();
  }
}

class SyntaxBindingDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  public provideDocumentSymbols(
    document: vscode.TextDocument,
    token: vscode.CancellationToken): Promise<vscode.DocumentSymbol[]> {
    return new Promise((resolve, reject) => {
      let symbols: vscode.DocumentSymbol[] = [];
      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        if (line.text.includes("/rsm:")) {
          // Some hacky JS slice'n'dice way with hardcoded values/offsets ... should be replaced with some regexp
          let name = line.text.slice(line.text.lastIndexOf('/', line.text.lastIndexOf('/') - 1) + 1, line.text.lastIndexOf('/'));
            name = name.slice(0, name.indexOf('"'));
          let colPosition = line.text.indexOf('"', line.text.indexOf('"') + 1) + 7 - name.length;
          let symbol = new vscode.DocumentSymbol(
            name, `Syntax Binding [Ln ${i + 1}, Col ${colPosition}]`,
            vscode.SymbolKind.Function,
            line.range, line.range)
          symbols.push(symbol)
        }
      }
      resolve(symbols);
    });
  }
}

const updateStatusBarItem = (): void => {
  const semanticsCount = getNumberFromSemanticsAttribute(vscode.window.activeTextEditor, 'semantic-nodes');
  const xmlCount = getNumberFromSemanticsAttribute(vscode.window.activeTextEditor, 'syntax-nodes');
  if (semanticsCount > 0) {
    idissStatusBarItem.text = `$(combine) ${semanticsCount} Semantic(s) found, ${xmlCount} XML Bindings(s) found`;
    idissStatusBarItem.show();
  } else {
    idissStatusBarItem.hide();
  }
  // For now, update TreeView title & description at the same time (update "fake badge" via description)
  vscode.commands.executeCommand('semanticView.changeTitle', {title: 'Semantic View', description: `(${semanticsCount})`});
  vscode.commands.executeCommand('xmlView.changeTitle', {title: 'XML View', description: `(${xmlCount})`});
}

const getNumberFromSemanticsAttribute = (editor: vscode.TextEditor | undefined, attributeName: string): number => {
  let lines = 0;
  if (editor) {
    const line = editor.document.lineAt(1); // assuming <semantics ...> is always at line 2 for now
    if (line.text.includes("semantics")) {
      const regex = new RegExp(`${attributeName}\=\"([A-Za-z0-9 _]*)\"`);
      lines = parseInt(regex.exec(line.text)[1], 10);
    }
  }

  return lines;
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
    if(uri.scheme === 'xmlView') {
      return this.provideDecoratorPerScheme(uri, new vscode.ThemeColor('debugTokenExpression.string'));
    }
  }
}
