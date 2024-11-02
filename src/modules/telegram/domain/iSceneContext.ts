import { SceneContext } from 'telegraf/typings/scenes';
import { WizardContext } from 'telegraf/scenes';

interface IContext extends SceneContext {
  message: SceneContext['message'] & {
    text: string;
  };
  update: SceneContext['update'] & {
    callback_query: {
      data: string;
    };
  };
  session: SceneContext['session'] & {
    state?: {
      type?: string;
      categoryId?: string;
      exchangeRate?: string;
      amount?: string;
      comment?: string;
      actionType?: string;
      spendingRange?: {
        startDate?: string;
        endDate?: string;
      };
    };
  };
}

interface IWizardContext extends WizardContext {
  message: WizardContext['message'] & {
    text: string;
  };
  update: WizardContext['update'] & {
    callback_query: {
      data: string;
    };
  };
  session: WizardContext['session'] & {
    state?: {
      type?: string;
      categoryId?: string;
      exchangeRate?: string;
      amount?: string;
      comment?: string;
    };
  };
}
export { IContext, IWizardContext };
