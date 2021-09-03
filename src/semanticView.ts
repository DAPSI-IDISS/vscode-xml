import * as vscode from 'vscode';

// Top-level-await with import would be a better solution but requires to use system: esnext and target: es2017 or higher >> ts(1378)
// See: https://v8.dev/features/top-level-await#dependency-fallbacks and https://github.com/tc39/proposal-top-level-await#dependency-fallbacks
// (it should be safe to use in VSCode - chromium, however, for now we just use a conditional require)
let semanticData;
try {
  semanticData = require('./../sample-data/semanticData.json');
} catch {
  semanticData = require('./../sample-data/semanticData_public.json');
}

export class SemanticView implements vscode.TreeDataProvider<Node> {
  private _onDidChangeTreeData: vscode.EventEmitter<Node[] | undefined> = new vscode.EventEmitter<Node[] | undefined>();
  // We want to use an array as the event type, so we use the proposed onDidChangeTreeData2.
  public onDidChangeTreeData2: vscode.Event<Node[] | undefined> = this._onDidChangeTreeData.event;
  // Add sample tree data
  public tree = semanticData; // TODO: correctly parse the keys required for Tree elements/nodes so we can get rid of the empty object props and provide additional infos in the JSON
  // Keep track of any nodes we create so that we can re-use the same objects.
  private nodes = {};

  constructor(context: vscode.ExtensionContext) {
    const view = vscode.window.createTreeView('semanticView', { treeDataProvider: this, showCollapseAll: true, canSelectMany: true });
    context.subscriptions.push(view);
    vscode.commands.registerCommand('semanticView.reveal', async () => {
      const key = await vscode.window.showInputBox({ placeHolder: 'Type the label of the Semantic item to reveal' });
      if (key) {
        await view.reveal({ key }, { focus: true, select: false, expand: true });
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
    vscode.commands.registerCommand('semanticView.searchEntry', (node: Node) => vscode.commands.executeCommand('search.action.openNewEditor', {query: node.key}));
  }

  // Tree data provider 

  public getChildren(element: Node): Node[] {
    return this._getChildren(element ? element.key : undefined).map(key => this._getNode(key));
  }

  public getTreeItem(element: Node): vscode.TreeItem {
    const treeItem = this._getTreeItem(element.key);
    treeItem.id = element.key;
    return treeItem;
  }
  public getParent(element: Node): Node {
    return this._getParent(element.key);
  }

  dispose(): void {
    console.log('destroy');
  }

  // Drag and drop controller (requires update)

  public async onDrop(sources: Node[], target: Node): Promise<void> {
    let roots = this._getLocalRoots(sources);
    // Remove nodes that are already target's parent nodes
    roots = roots.filter(r => !this._isChild(this._getTreeElement(r.key), target));
    if (roots.length > 0) {
      // Reload parents of the moving elements
      const parents = roots.map(r => this.getParent(r));
      roots.forEach(r => this._reparentNode(r, target));
      this._onDidChangeTreeData.fire([...parents, target]);
    }
  }

  // ----------------------------------------
  // Helper methods
  // ----------------------------------------

  _isChild(node: Node, child: Node): boolean {
    for (const prop in node) {
      if (prop === child.key) {
        return true;
      } else {
        const isChild = this._isChild(node[prop], child);
        if (isChild) {
          return isChild;
        }
      }
    }
    return false;
  }

  // From the given nodes, filter out all nodes who's parent is already in the the array of Nodes.
  _getLocalRoots(nodes: Node[]): Node[] {
    const localRoots = [];
    for (let i = 0; i < nodes.length; i++) {
      const parent = this.getParent(nodes[i]);
      if (parent) {
        const isInList = nodes.find(n => n.key === parent.key);
        if (isInList === undefined) {
          localRoots.push(nodes[i]);
        }
      } else {
        localRoots.push(nodes[i]);
      }
    }
    return localRoots;
  }

  // Remove node from current position and add node to new target element
  _reparentNode(node: Node, target: Node): void {
    const element = {};
    element[node.key] = this._getTreeElement(node.key);
    const elementCopy = { ...element };
    this._removeNode(node);
    const targetElement = this._getTreeElement(target.key);
    if (Object.keys(element).length === 0) {
      targetElement[node.key] = {};
    } else {
      Object.assign(targetElement, elementCopy);
    }
  }

  // Remove node from tree
  _removeNode(element: Node, tree?: any): void {
    const subTree = tree ? tree : this.tree;
    for (const prop in subTree) {
      if (prop === element.key) {
        const parent = this.getParent(element);
        if (parent) {
          const parentObject = this._getTreeElement(parent.key);
          delete parentObject[prop];
        } else {
          delete this.tree[prop];
        }
      } else {
        this._removeNode(element, subTree[prop]);
      }
    }
  }

  _getChildren(key: string): string[] {
    if (!key) {
      return Object.keys(this.tree);
    }
    const treeElement = this._getTreeElement(key);
    if (treeElement) {
      return Object.keys(treeElement);
    }
    return [];
  }

  _getTreeItem(key: string): vscode.TreeItem {
    const treeElement = this._getTreeElement(key);
    // An example of how to use codicons in a MarkdownString in a tree item tooltip.
    return {
      label: /**vscode.TreeItemLabel**/<any>{ label: key }, // TreeItemLabel not implemented yet?
      tooltip: key,
      // Use TreeItemCollapsibleState.Collapsed instead of .Expanded for a compact view by default (could be added to settings)
      collapsibleState: treeElement && Object.keys(treeElement).length ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
      resourceUri: vscode.Uri.parse(`semanticView:${key}`),
      iconPath: new vscode.ThemeIcon('symbol-variable'),
    };
  }

  _getTreeElement(element: string, tree?: any): Node {
    const currentNode = tree ?? this.tree;
    for (const prop in currentNode) {
      if (prop === element) {
        return currentNode[prop];
      } else {
        const treeElement = this._getTreeElement(element, currentNode[prop]);
        if (treeElement) {
          return treeElement;
        }
      }
    }
  }

  _getParent(element: string, parent?: string, tree?): any {
    const currentNode = tree ?? this.tree;
    for (const prop in currentNode) {
      if (prop === element && parent) {
        return this._getNode(parent);
      } else {
        const parent = this._getParent(element, prop, currentNode[prop]);
        if (parent) {
          return parent;
        }
      }
    }
  }

  _getNode(key: string): Node {
    if (!this.nodes[key]) {
      this.nodes[key] = new Key(key);
    }
    return this.nodes[key];
  }
}

type Node = { key: string };

class Key {
  constructor(readonly key: string) { }
}
