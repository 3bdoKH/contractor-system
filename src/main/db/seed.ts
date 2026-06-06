import type { Database } from 'sql.js';

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

export function seedMerchandise(db: Database) {
  for (const item of MERCHANDISE_ITEMS) {
    db.run('INSERT OR IGNORE INTO merchandise (name) VALUES (?)', [item]);
  }
}
