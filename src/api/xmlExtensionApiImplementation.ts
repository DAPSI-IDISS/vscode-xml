import { DidChangeConfigurationNotification } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { RequirementsData } from "../server/requirements";
import { ExternalXxxSettings } from "../settings/externalXmlSettings";
import { getXXXSettings, onConfigurationChange } from "../settings/settings";
import { XXXExtensionApi, XXXFileAssociation } from "./xmlExtensionApi";

/**
 * Returns the implementation of the vscode-xml extension API
 *
 * @param languageClient
 * @param logfile
 * @param externalXxxSettings
 * @param requirementsData
 * @return the implementation of the vscode-xml extension API
 */
export function getXxxExtensionApiImplementation(languageClient: LanguageClient, logfile: string, externalXxxSettings: ExternalXxxSettings, requirementsData: RequirementsData): XXXExtensionApi {
  return {
    // add API set catalogs to internal memory
    addXXXCatalogs: (catalogs: string[]) => {
      const externalXxxCatalogs = externalXxxSettings.xxxCatalogs;
      catalogs.forEach(element => {
        if (!externalXxxCatalogs.includes(element)) {
          externalXxxCatalogs.push(element);
        }
      });
      languageClient.sendNotification(DidChangeConfigurationNotification.type, { settings: getXXXSettings(requirementsData.java_home, logfile, externalXxxSettings) });
      onConfigurationChange();
    },
    // remove API set catalogs to internal memory
    removeXXXCatalogs: (catalogs: string[]) => {
      catalogs.forEach(element => {
        const externalXxxCatalogs = externalXxxSettings.xxxCatalogs;
        if (externalXxxCatalogs.includes(element)) {
          const itemIndex = externalXxxCatalogs.indexOf(element);
          externalXxxCatalogs.splice(itemIndex, 1);
        }
      });
      languageClient.sendNotification(DidChangeConfigurationNotification.type, { settings: getXXXSettings(requirementsData.java_home, logfile, externalXxxSettings) });
      onConfigurationChange();
    },
    // add API set fileAssociations to internal memory
    addXXXFileAssociations: (fileAssociations: XXXFileAssociation[]) => {
      const externalfileAssociations = externalXxxSettings.xxxFileAssociations;
      fileAssociations.forEach(element => {
        if (!externalfileAssociations.some(fileAssociation => fileAssociation.systemId === element.systemId)) {
          externalfileAssociations.push(element);
        }
      });
      languageClient.sendNotification(DidChangeConfigurationNotification.type, { settings: getXXXSettings(requirementsData.java_home, logfile, externalXxxSettings) });
      onConfigurationChange();
    },
    // remove API set fileAssociations to internal memory
    removeXXXFileAssociations: (fileAssociations: XXXFileAssociation[]) => {
      const externalfileAssociations = externalXxxSettings.xxxFileAssociations;
      fileAssociations.forEach(element => {
        const itemIndex = externalfileAssociations.findIndex(fileAssociation => fileAssociation.systemId === element.systemId) //returns -1 if item not found
        if (itemIndex > -1) {
          externalfileAssociations.splice(itemIndex, 1);
        }
      });
      languageClient.sendNotification(DidChangeConfigurationNotification.type, { settings: getXXXSettings(requirementsData.java_home, logfile, externalXxxSettings) });
      onConfigurationChange();
    }
  } as XXXExtensionApi;
}
