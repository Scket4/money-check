import { MainMenuScene } from './main-menu.scene';
import { CreateRecordScene } from './create-record.scene';
import spendingScenes from './spending/index';
import incomeScenes from './income/index';
import planScenes from './plan/index';

export default [
  MainMenuScene,
  CreateRecordScene,
  ...spendingScenes,
  ...incomeScenes,
  ...planScenes,
];
