import { asMock } from '../../../../__tests__/utils';
import { jester as mockJester } from '../../../../credentials/__tests__/fixtures-constants';
import { testKeystore } from '../../../__tests__/fixtures-android';
import { createCtxMock } from '../../../__tests__/fixtures-context';
import { askForUserProvidedAsync } from '../../../utils/promptForCredentials';
import { getAppLookupParamsFromContextAsync } from '../BuildCredentialsUtils';
import { CreateKeystore } from '../CreateKeystore';

jest.mock('../../../utils/promptForCredentials');
jest.mock('../../../../project/ensureProjectExists');
jest.mock('../../../../prompts', () => ({ confirmAsync: jest.fn(() => true) }));
jest.mock('../../../../user/actions', () => ({ ensureLoggedInAsync: jest.fn(() => mockJester) }));

describe('CreateKeystore', () => {
  it('creates a keystore in Interactive Mode', async () => {
    const ctx = createCtxMock({ nonInteractive: false });
    const appLookupParams = await getAppLookupParamsFromContextAsync(ctx);
    const createKeystoreAction = new CreateKeystore(appLookupParams.account);
    await createKeystoreAction.runAsync(ctx);

    // expect keystore to be created on expo servers
    expect(ctx.android.createKeystoreAsync as any).toHaveBeenCalledTimes(1);
  });
  it('creates a keystore by uploading', async () => {
    asMock(askForUserProvidedAsync).mockImplementationOnce(() => testKeystore);
    const ctx = createCtxMock({ nonInteractive: false });
    const appLookupParams = await getAppLookupParamsFromContextAsync(ctx);
    const createKeystoreAction = new CreateKeystore(appLookupParams.account);
    await createKeystoreAction.runAsync(ctx);

    // expect keystore to be created on expo servers
    expect(ctx.android.createKeystoreAsync as any).toHaveBeenCalledTimes(1);
    expect(ctx.android.createKeystoreAsync as any).toHaveBeenCalledWith(
      appLookupParams.account,
      expect.objectContaining(testKeystore)
    );
  });
  it('errors in Non-Interactive Mode', async () => {
    const ctx = createCtxMock({ nonInteractive: true });
    const appLookupParams = await getAppLookupParamsFromContextAsync(ctx);
    const createKeystoreAction = new CreateKeystore(appLookupParams.account);

    // fail if users are running in non-interactive mode
    await expect(createKeystoreAction.runAsync(ctx)).rejects.toThrowError();
  });
});
