import { Markup } from 'telegraf';

export function isNumeric(str: any) {
  return !isNaN(str) && !isNaN(parseFloat(str));
}

export function chunkArray(array: any, chunkSize: number): any[] {
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
}

export function getMonthName(monthNumber: number): string {
  const months = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ];

  return months[monthNumber - 1]; // Возвращаем название месяца
}

export function generateButtonsWithNameAndId(
  buttons: Array<{ name: string; id: string | number; [key: string]: any }>,
) {
  const array = chunkArray(buttons, 3);

  return Markup.inlineKeyboard(
    array.map((i) => {
      return i.map((e: any) => {
        return Markup.button.callback(e.name, String(e.id));
      });
    }),
  );
}
