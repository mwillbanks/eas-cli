import { ExpoConfig } from '@expo/config';
import { AndroidConfig } from '@expo/config-plugins';
import { Platform, Workflow } from '@expo/eas-build-job';
import { BuildProfile } from '@expo/eas-json';
import fs from 'fs-extra';

import { resolveWorkflowAsync } from '../../project/workflow';

export async function maybeResolveVersionsAsync(
  projectDir: string,
  exp: ExpoConfig,
  buildProfile: BuildProfile<Platform.ANDROID>
): Promise<{ appVersion?: string; appBuildVersion?: string }> {
  const workflow = await resolveWorkflowAsync(projectDir, Platform.ANDROID);
  if (workflow === Workflow.GENERIC) {
    const buildGradle = await AndroidConfig.BuildGradle.getAppBuildGradleAsync(projectDir);
    const parsedGradleCommand = buildProfile.gradleCommand
      ? AndroidConfig.BuildGradle.parseGradleCommand(buildProfile.gradleCommand, buildGradle)
      : undefined;

    return {
      appVersion: AndroidConfig.BuildGradle.resolveConfigValue(
        buildGradle,
        parsedGradleCommand?.flavor,
        'versionName'
      ),
      appBuildVersion: AndroidConfig.BuildGradle.resolveConfigValue(
        buildGradle,
        parsedGradleCommand?.flavor,
        'versionCode'
      ),
    };
  } else {
    return {
      appBuildVersion: String(AndroidConfig.Version.getVersionCode(exp) ?? 1),
      appVersion: exp.version,
    };
  }
}
