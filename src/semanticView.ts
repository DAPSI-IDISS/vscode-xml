import * as vscode from 'vscode';
import * as json from 'jsonc-parser';

// Top-level-await with import would be a better solution but requires to use system: esnext and target: es2017 or higher >> ts(1378)
// See: https://v8.dev/features/top-level-await#dependency-fallbacks and https://github.com/tc39/proposal-top-level-await#dependency-fallbacks
// (it should be safe to use in VSCode - chromium, however, for now we just use a conditional require)
let semanticData: JSON;
try {
  semanticData = require('./../sample-data/semanticData.json');
} catch {
  semanticData = require('./../sample-data/semanticData_public.json');
}

export class SemanticView implements vscode.TreeDataProvider<number> {
  private _onDidChangeTreeData: vscode.EventEmitter<number | undefined> = new vscode.EventEmitter<number | undefined>();
  readonly onDidChangeTreeData: vscode.Event<number | undefined> = this._onDidChangeTreeData.event;
  private tree: json.Node;
  private text: string;

  constructor(private context: vscode.ExtensionContext) {
    // Add sample tree data
    this.parseTree();

    const view = vscode.window.createTreeView('semanticView', { treeDataProvider: this, showCollapseAll: true, canSelectMany: true });
    context.subscriptions.push(view);
    vscode.commands.registerCommand('semanticView.reveal', async () => {
      const key = await vscode.window.showInputBox({ placeHolder: 'Type the Node Path of the Semantic item to reveal' });
      if (key) {
        view.reveal(this.getElementOffsetByPath(key), { focus: true, select: false, expand: true });
      }
    });
    vscode.commands.registerCommand('semanticView.changeTitle', async (args) => {
      if (args.title && args.description) {
        view.title = args.title;
        view.description = args.description;
      } else {
        const title = await vscode.window.showInputBox({ prompt: 'Type the new title for the Semantic View', placeHolder: view.title });
        if (title) {
          view.title = title;
        }
      }
    });
    vscode.commands.registerCommand('semanticView.searchEntry', (offset: number) => {
      vscode.commands.executeCommand('search.action.openNewEditor', {query: this.getLabel(this.getValueNode(offset))});
    });
  }

  // Tree data provider 

  public getChildren(offset?: number): Thenable<number[]> {
    if (offset) {
      const path = json.getLocation(this.text, offset).path;
      const node = json.findNodeAtLocation(this.tree, path);
      return Promise.resolve(this.getChildrenOffsets(node));
    } else {
      return Promise.resolve(this.tree ? this.getChildrenOffsets(this.tree) : []);
    }
  }

  public getTreeItem(offset: number): vscode.TreeItem {
    const valueNode = this.getValueNode(offset);
    if (valueNode) {
      const hasChildren = valueNode.type === 'object' || valueNode.type === 'array' ? valueNode.children.length ? true : false : false;
      const treeItem: vscode.TreeItem = new vscode.TreeItem(this.getLabel(valueNode));
      treeItem.collapsibleState = hasChildren ? valueNode.type === 'object' ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
      treeItem.iconPath = new vscode.ThemeIcon('symbol-variable');
      treeItem.contextValue = valueNode.type;
      treeItem.resourceUri = vscode.Uri.parse(`semanticView:${this.getLabel(valueNode)}`);
      treeItem.tooltip = `Node Path: '${json.getNodePath(valueNode).join('/')}'`;

      return treeItem;
    }
    return undefined;
  }

  // required to allow TreeView.reveal
  public getParent(offset?: number): number {
    return 0;
  }

  // ----------------------------------------
  // Helper methods
  // ----------------------------------------

  private parseTree(): void {
    this.text = JSON.stringify(semanticData).toString();
    this.tree = json.parseTree(this.text);
  }

  private getChildrenOffsets(node: json.Node): number[] {
    const offsets: number[] = [];
    for (const child of node.children) {
      const childPath = json.getLocation(this.text, child.offset).path;
      const childNode = json.findNodeAtLocation(this.tree, childPath);
      if (childNode) {
        offsets.push(childNode.offset);
      }
    }
    return offsets;
  }
  
  private getLabel(node: json.Node): string {
    if (node.parent.type === 'array') {
      const prefix = node.parent.children.indexOf(node).toString();
      if (node.type === 'object' || node.type === 'array') {
        return prefix;
      }
      return prefix + ':' + node.value.toString();
    } else {
      const property = node.parent.children[0].value.toString();
      if (node.type === 'array' || node.type === 'object') {
        return property;
      }
      const value = node.value;

      return `${property}: ${value}`;
    }
  }

  private getValueNode(offset: number): json.Node {
    const path = json.getLocation(this.text, offset).path;
    const valueNode = json.findNodeAtLocation(this.tree, path);

    return valueNode;
  }

  private getElementOffsetByPath(path: string): number {
    // remove preceding slash
    const pathString = (path.length && path[0] === '/') ? path.slice(1) : path;
    // split path to a sequence of strings (representing an object property) or converted numbers (for array indices)
    const nodePath: json.JSONPath = pathString.split('/').map(str => this.isNumeric(str) ? Number(str) : str);
    const nodeElement = json.findNodeAtLocation(this.tree, nodePath);

    return nodeElement.offset;
  }

  private isNumeric = (num: string) => {
    return !isNaN(num as unknown as number)
  }
}
