import * as LocalSession from 'telegraf-session-local';
import * as path from 'path';

export default new LocalSession({
  database: path.resolve('./src/modules/telegram/database/scenes-db.json.json'),
});
