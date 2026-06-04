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
  'اعتاب x 100',
  'اعتاب x 120',
  'اعتاب x 150',
  'اعتاب x 200',
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
  const count = (db.prepare('SELECT COUNT(*) as count FROM merchandise').get() as { count: number }).count;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO merchandise (name) VALUES (?)');
    const insertMany = db.transaction((items: string[]) => {
      for (const item of items) {
        insert.run(item);
      }
    });
    insertMany(MERCHANDISE_ITEMS);
  }
}
