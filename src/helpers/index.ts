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
