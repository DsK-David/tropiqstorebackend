module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: 'mysql-blogdavid.alwaysdata.net',
      port: 3306,
      user: 'blogdavid',
      password: 'dskdavid2513',
      database: 'blogdavid_tropiqstore'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }
};