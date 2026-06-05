import Database from 'better-sqlite3';

const MERCHANDISE_ITEMS = [
  'اسمنت ابيض',
  'اسمنت اسود',
  'طوب احمر',
  'طوب ابيض',
  'سن',
  'رمل ابيض',
  'رمل اصفر',
  'زلط',
  'حديد',
  'بودرة',
  'اعتاب 100 سم',
  'اعتاب 120 سم',
  'اعتاب 150 سم',
  'اعتاب 200 سم',
  'مسمار',
  'شمبر',
  'سلك',
  'سيخ 3 لنيا',
  'سيخ 4 لنيا',
  'سيخ 5 لنيا',
  'حديد 2.5',
  'مباني',
  'مصنعيه',
];

export function seedMerchandise(db: Database.Database) {
  const insert = db.prepare('INSERT OR IGNORE INTO merchandise (name) VALUES (?)');
  const insertMany = db.transaction((items: string[]) => {
    for (const item of items) {
      insert.run(item);
    }
  });
  insertMany(MERCHANDISE_ITEMS);
}
