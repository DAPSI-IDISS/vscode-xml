/**
 * Interface for APIs exposed from the extension.
 *
 * @remarks
 * A sample code to use these APIs are as following:
 * const ext = await vscode.extensions.getExtension('redhat.vscode-xml').activate();
 * ext.addXXXCatalogs(...);
 * ext.removeXXXCatalogs(...);
 * ext.addXXXFileAssociations(...);
 * ext.removeXXXFileAssociations(...);
 */
export interface XXXExtensionApi {
  /**
   * Adds XXX Catalogs in addition to the catalogs defined in the settings.json file.
   *
   * @remarks
   * An example is to call this API:
   * ```ts
   * addXXXCatalogs(['path/to/catalog.xxx', 'path/to/anotherCatalog.xxx'])
   * ```
   * @param catalogs - A list of path to XXX catalogs
   * @returns None
   */
  addXXXCatalogs(catalogs: string[]): void;
  /**
   * Removes XXX Catalogs from the extension.
   *
   * @remarks
   * An example is to call this API:
   * ```ts
   * removeXXXCatalogs(['path/to/catalog.xxx', 'path/to/anotherCatalog.xxx'])
   * ```
   * @param catalogs - A list of path to XXX catalogs
   * @returns None
   */
  removeXXXCatalogs(catalogs: string[]): void;
  /**
   * Adds XXX File Associations in addition to the catalogs defined in the settings.json file.
   *
   * @remarks
   * An example is to call this API:
   * ```ts
   * addXXXFileAssociations([{
   *    "systemId": "path/to/file.xsd",
   *    "pattern": "file1.xxx"
   *  },{
   *    "systemId": "http://www.w3.org/2001/XMLSchema.xsd",
   *    "pattern": "file2.xxx"
   *  }])
   * ```
   * @param fileAssociations - A list of file association
   * @returns None
   */
  addXXXFileAssociations(fileAssociations: XXXFileAssociation[]): void;
  /**
   * Removes XXX File Associations from the extension.
   *
   * @remarks
   * An example is to call this API:
   * ```ts
   * removeXXXFileAssociations([{
   *    "systemId": "path/to/file.xsd",
   *    "pattern": "file1.xxx"
   *  },{
   *    "systemId": "http://www.w3.org/2001/XMLSchema.xsd",
   *    "pattern": "file2.xxx"
   *  }])
   * ```
   * @param fileAssociations - A list of file association
   * @returns None
   */
  removeXXXFileAssociations(fileAssociations: XXXFileAssociation[]): void;

}

/**
 * Interface for the FileAssociation shape.
 * @param systemId - The path to a valid XSD.
 * @param pattern - The file pattern associated with the XSD.
 *
 * @returns None
 */
export interface XXXFileAssociation {
  systemId: string,
  pattern: string;
}