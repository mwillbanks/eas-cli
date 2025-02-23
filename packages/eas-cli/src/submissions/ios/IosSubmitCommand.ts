import { Result, result } from '@expo/results';
import chalk from 'chalk';
import getenv from 'getenv';
import wrapAnsi from 'wrap-ansi';

import { AppPlatform, SubmissionFragment } from '../../graphql/generated';
import Log, { learnMore } from '../../log';
import { promptAsync } from '../../prompts';
import UserSettings from '../../user/UserSettings';
import { ArchiveSource, ArchiveTypeSourceType } from '../archiveSource';
import { resolveArchiveFileSource } from '../commons';
import { IosSubmissionContext, IosSubmitCommandFlags } from '../types';
import { ensureAppStoreConnectAppExistsAsync } from './AppProduce';
import {
  AppSpecificPasswordSource,
  AppSpecificPasswordSourceType,
} from './AppSpecificPasswordSource';
import IosSubmitter, { IosSubmissionOptions } from './IosSubmitter';

class IosSubmitCommand {
  static createContext({
    projectDir,
    projectId,
    commandFlags,
  }: {
    projectDir: string;
    projectId: string;
    commandFlags: IosSubmitCommandFlags;
  }): IosSubmissionContext {
    return {
      projectDir,
      projectId,
      commandFlags,
    };
  }

  constructor(private ctx: IosSubmissionContext) {}

  async runAsync(): Promise<SubmissionFragment> {
    Log.addNewLineIfNone();
    const options = await this.resolveSubmissionOptionsAsync();
    const submitter = new IosSubmitter(this.ctx, options);
    return await submitter.submitAsync();
  }

  private async resolveSubmissionOptionsAsync(): Promise<IosSubmissionOptions> {
    const archiveSource = this.resolveArchiveSource(this.ctx.projectId);
    const appSpecificPasswordSource = this.resolveAppSpecificPasswordSource();

    const errored = [archiveSource, appSpecificPasswordSource].filter(r => !r.ok);
    if (errored.length > 0) {
      const message = errored.map(err => err.reason?.message).join('\n');
      Log.error(message);
      throw new Error('Failed to submit the app');
    }

    const { appleId, ascAppId } = await this.getAppStoreInfoAsync();

    return {
      projectId: this.ctx.projectId,
      appleId,
      ascAppId,
      archiveSource: archiveSource.enforceValue(),
      appSpecificPasswordSource: appSpecificPasswordSource.enforceValue(),
    };
  }

  private resolveAppSpecificPasswordSource(): Result<AppSpecificPasswordSource> {
    const envAppSpecificPassword = getenv.string('EXPO_APPLE_APP_SPECIFIC_PASSWORD', '');

    if (envAppSpecificPassword) {
      return result({
        sourceType: AppSpecificPasswordSourceType.userDefined,
        appSpecificPassword: envAppSpecificPassword,
      });
    }

    return result({
      sourceType: AppSpecificPasswordSourceType.prompt,
    });
  }

  private resolveArchiveSource(projectId: string): Result<ArchiveSource> {
    return result({
      archiveFile: resolveArchiveFileSource(AppPlatform.Ios, this.ctx, projectId),
      archiveType: { sourceType: ArchiveTypeSourceType.infer },
    });
  }

  /**
   * Returns App Store related information required for build submission
   * It is:
   * - User Apple ID
   * - App Store Connect app ID (appAppleId)
   */
  private async getAppStoreInfoAsync(): Promise<{
    appleId: string;
    ascAppId: string;
  }> {
    const { ascAppId } = this.ctx.commandFlags;

    if (ascAppId) {
      return {
        appleId: await this.getAppleIdAsync(),
        ascAppId,
      };
    }

    Log.log(
      wrapAnsi(
        chalk.italic(
          'Ensuring your app exists on App Store Connect. ' +
            `This step can be skipped by providing the --asc-app-id param. ${learnMore(
              'https://expo.fyi/asc-app-id'
            )}`
        ),
        process.stdout.columns || 80
      )
    );
    Log.addNewLineIfNone();
    return await ensureAppStoreConnectAppExistsAsync(this.ctx);
  }

  /**
   * This is going to be used only when `produce` is not being run,
   * and we don't need to call full credentials.authenticateAsync()
   * and we just need apple ID
   */
  private async getAppleIdAsync(): Promise<string> {
    const { appleId } = this.ctx.commandFlags;
    const envAppleId = getenv.string('EXPO_APPLE_ID', '');

    if (appleId) {
      return appleId;
    } else if (envAppleId) {
      return envAppleId;
    }

    // Get the email address that was last used and set it as
    // the default value for quicker authentication.
    const lastAppleId = await UserSettings.getAsync('appleId', null);

    const { appleId: promptAppleId } = await promptAsync({
      type: 'text',
      name: 'appleId',
      message: `Enter your Apple ID:`,
      validate: (val: string) => !!val,
      initial: lastAppleId ?? undefined,
    });

    return promptAppleId;
  }
}

export default IosSubmitCommand;
