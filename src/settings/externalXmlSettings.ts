import { XXXFileAssociation } from "../api/xmlExtensionApi";

/**
 * Represents vscode-xml settings that other vscode extensions can contribute to
 */
export class ExternalXxxSettings {

  private _xxxCatalogs: string[]
  private _xxxFileAssociations: XXXFileAssociation[]

  constructor() {
    this._xxxCatalogs = [];
    this._xxxFileAssociations = [];
  }

  get xxxCatalogs(): string[] {
    return this._xxxCatalogs;
  }

  get xxxFileAssociations(): any[] {
    return this._xxxFileAssociations;
  }

}