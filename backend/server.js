const express = require('express');
const mysql = require('mysql2');
const dbConfig = require('../config');
const app = express();

const port = 35590

// 创建连接池
const pool = mysql.createPool({
    connectionLimit: 5, // 设置连接池的大小
    ...dbConfig
});

// 设置跨域访问
app.all('*', function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', '*');
    if (req.method === 'OPTIONS') {
        res.sendStatus(204);
        return;
    }
    next();
});

app.use(express.json())
app.use(express.urlencoded({ extended: false }))


// app.get('/nuclear_data/options', function (req, res) {
//     // 从连接池中获取一个连接
//     pool.getConnection(function (err, connection) {
//         if (err) {
//             console.error(err);
//             res.status(500).send('服务器错误');
//         } else {
//             // 查询数据库，获取所有的名称和位置，去重
//             // let sql = `SELECT DISTINCT name, location FROM nuclear_data`;
//             let sql = `SELECT DISTINCT name FROM nuclear_data`;
//             connection.query(sql, function (err, result) {
//                 if (err) {
//                     console.error(err);
//                     res.status(500).send('服务器错误');
//                 } else {
//                     // 返回查询结果
//                     res.json(result);
//                 }
//                 // 释放连接
//                 connection.release();
//             });
//         }
//     });
// });

app.post('/nuclear_data/options/names', function (req, res) {
    // 获取请求参数
    let type = req.body?.type;

    // 从连接池中获取一个连接
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err);
            res.status(500).send('服务器错误');
        } else {
            // 查询数据库，获取名称列表，type 为空时返回全部
            const params = [];
            let sql = `SELECT DISTINCT name FROM nuclear_data`;
            if (type) {
                sql += ` WHERE type = ?`;
                params.push(type);
            }
            sql += ` ORDER BY name`;
            connection.query(sql, params, function (err, result) {
                if (err) {
                    console.error(err);
                    res.status(500).send('服务器错误');
                } else {
                    // 返回查询结果
                    res.json(result);
                }
                // 释放连接
                connection.release();
            });
        }
    });
});

app.post('/nuclear_data/options/locations', function (req, res) {
    // 获取请求参数
    let type = req.body?.type;
    let name = req.body?.name;

    // 从连接池中获取一个连接
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err);
            res.status(500).send('服务器错误');
        } else {
            // 查询数据库，获取位置列表，条件为空时不限制
            const params = [];
            const where = [];
            if (type) {
                where.push('type = ?');
                params.push(type);
            }
            if (name) {
                where.push('name = ?');
                params.push(name);
            }
            let sql = `SELECT DISTINCT location FROM nuclear_data`;
            if (where.length) {
                sql += ` WHERE ${where.join(' AND ')}`;
            }
            sql += ` ORDER BY location`;
            connection.query(sql, params, function (err, result) {
                if (err) {
                    console.error(err);
                    res.status(500).send('服务器错误');
                } else {
                    // 返回查询结果
                    res.json(result);
                }
                // 释放连接
                connection.release();
            });
        }
    });
});

// 筛选选项树（类型-名称-位置），进程内缓存 10 分钟
let optionsTreeCache = { data: null, at: 0 }

app.get('/nuclear_data/options/tree', function (req, res) {
    if (optionsTreeCache.data && Date.now() - optionsTreeCache.at < 10 * 60 * 1000) {
        res.json(optionsTreeCache.data);
        return;
    }

    const sql = `SELECT type, name, location FROM nuclear_data GROUP BY type, name, location ORDER BY type, name, location`;
    pool.query(sql, function (err, rows) {
        if (err) {
            console.error(err);
            res.status(500).send('服务器错误');
            return;
        }
        const byType = new Map();
        for (const row of rows) {
            if (!row.name || !row.location) continue;
            if (!byType.has(row.type)) byType.set(row.type, new Map());
            const byName = byType.get(row.type);
            if (!byName.has(row.name)) byName.set(row.name, []);
            byName.get(row.name).push(row.location);
        }
        const data = [];
        for (const [type, byName] of byType) {
            for (const [name, locations] of byName) {
                data.push({ type, name, locations });
            }
        }
        optionsTreeCache = { data, at: Date.now() };
        res.json(data);
    });
});

app.post('/nuclear_data', function (req, res) {
    // 获取请求参数
    let name = req.body?.name;
    let location = req.body?.location;
    let date = req.body?.date;

    // console.log('param', name, location, date)

    // 从连接池中获取一个连接
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err);
            res.status(500).send('服务器错误');
        } else {
            // 查询数据库
            // let sql = `SELECT * FROM nuclear_data WHERE name = ? AND location = ? AND date = ?`;
            let sql = `SELECT * FROM nuclear_data WHERE name = ? AND location = ? AND date BETWEEN DATE_SUB(?, INTERVAL 3 DAY) AND ? ORDER BY date`;
            connection.query(sql, [name, location, date, date], function (err, result) {
                if (err) {
                    console.error(err);
                    res.status(500).send('服务器错误');
                } else {
                    // 返回查询结果
                    res.json(result);
                }
                // 释放连接
                connection.release();
            });
        }
    });
});

// 开放接口
app.post('/api/nuclear_data/export', function (req, res) {
    // 获取请求参数
    let year = req.body?.year;
    let month = req.body?.month;
    // let day = req.body?.day;

    if (!year || !month || year.indexOf('.') != -1 || month.indexOf('.') != -1) {
        res.status(400).send('参数错误');
    }

    year = Number(year);
    month = Number(month);

    if (isNaN(year) || isNaN(month) || year < 2023 || year > 3000 || month < 1 || month > 12) {
        res.status(400).send('参数错误');
        return
    }

    // if (day) {
    //     if (day.indexOf('.') != -1) {
    //         res.status(400).send('参数错误');
    //     }
    //     day = Number(day);
    //     if (isNaN(day) || day < 1 || day > 31) {
    //         res.status(400).send('参数错误');
    //         return
    //     }
    // }

    // console.log('param', name, location, date)

    // 从连接池中获取一个连接
    pool.getConnection(function (err, connection) {
        if (err) {
            console.error(err);
            res.status(500).send('服务器错误');
        } else {
            // 查询数据库
            let sql = `SELECT date,type,name,location,value FROM nuclear_data WHERE YEAR(date) = ? AND MONTH(date) = ? ORDER BY date,type,name,location`;
            connection.query(sql, [year, month], function (err, result) {
                if (err) {
                    console.error(err);
                    res.status(500).send('服务器错误');
                } else {
                    // 返回查询结果
                    res.json(result.map(i => {
                        if (i.date) {
                            let date = new Date(i.date)
                            let year = date.getFullYear();
                            let month = date.getMonth() + 1;
                            if (month < 10) month = `0${month}`
                            let day = date.getDate();
                            if (day < 10) day = `0${day}`
                            i.date = year + "-" + month + "-" + day;
                            // i.date2 = new Date(new Date(i.date).getTime() + 8 * 3600 * 1000).toISOString().substring(0, 10)
                        }
                        return i
                    }));
                }
                // 释放连接
                connection.release();
            });
        }
    });
});


// 多条件分页查询
app.post('/nuclear_data/list', function (req, res) {
    const body = req.body || {};

    let page = parseInt(body.page, 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    let pageSize = parseInt(body.pageSize, 10);
    if (!Number.isFinite(pageSize)) pageSize = 20;
    pageSize = Math.min(Math.max(pageSize, 10), 200);

    const type = body.type === '0' || body.type === '1' ? body.type : null;
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null;
    const location = typeof body.location === 'string' && body.location.trim() ? body.location.trim() : null;
    const level = body.level === 'summary' || body.level === 'station' ? body.level : null;
    const keyword = typeof body.keyword === 'string' ? body.keyword.trim().slice(0, 100) : '';
    const dateStart = isValidDateStr(body.dateStart) ? body.dateStart : null;
    const dateEnd = isValidDateStr(body.dateEnd) ? body.dateEnd : null;
    const valueMin = toFiniteNumber(body.valueMin);
    const valueMax = toFiniteNumber(body.valueMax);

    if (dateStart && dateEnd && dateStart > dateEnd) {
        res.status(400).send('日期范围不合法');
        return;
    }
    if (valueMin !== null && valueMax !== null && valueMin > valueMax) {
        res.status(400).send('数值范围不合法');
        return;
    }

    const where = [];
    const params = [];
    if (type) {
        where.push('type = ?');
        params.push(type);
    }
    if (name) {
        where.push('name = ?');
        params.push(name);
    }
    if (location) {
        where.push('location = ?');
        params.push(location);
    }
    if (dateStart) {
        where.push('date >= ?');
        params.push(dateStart);
    }
    if (dateEnd) {
        where.push('date <= ?');
        params.push(dateEnd);
    }
    if (valueMin !== null) {
        where.push(`CAST(SUBSTRING_INDEX(value, ' ', 1) AS DECIMAL(12,2)) >= ?`);
        params.push(valueMin);
    }
    if (valueMax !== null) {
        where.push(`CAST(SUBSTRING_INDEX(value, ' ', 1) AS DECIMAL(12,2)) <= ?`);
        params.push(valueMax);
    }
    if (level === 'summary') {
        where.push('parent_id IS NULL');
    }
    if (level === 'station') {
        where.push('parent_id IS NOT NULL');
    }
    if (keyword) {
        const like = `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;
        where.push('(name LIKE ? OR location LIKE ?)');
        params.push(like, like);
    }
    const whereSql = where.length ? ` WHERE ${where.join(' AND ')}` : '';

    const sortColumns = {
        date: 'date',
        name: 'name',
        location: 'location',
        value: `CAST(SUBSTRING_INDEX(value, ' ', 1) AS DECIMAL(12,2))`,
        time: 'time',
    };
    const sortColumn = sortColumns[body.sortBy] || 'date';
    const sortOrder = String(body.sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const countSql = `SELECT COUNT(*) AS total FROM nuclear_data${whereSql}`;
    const rowsSql = `SELECT nuclear_data_id, name, location, value,
                            DATE_FORMAT(date, '%Y-%m-%d') AS date,
                            parent_id, type, id, itemkey, itemcode, itemname, time
                     FROM nuclear_data${whereSql}
                     ORDER BY ${sortColumn} ${sortOrder}, nuclear_data_id ${sortOrder}
                     LIMIT ? OFFSET ?`;

    pool.query(countSql, params, function (err, countResult) {
        if (err) {
            console.error(err);
            res.status(500).send('服务器错误');
            return;
        }
        const total = countResult[0].total;
        const maxPage = Math.max(1, Math.ceil(total / pageSize));
        if (page > maxPage) page = maxPage;
        const offset = (page - 1) * pageSize;
        pool.query(rowsSql, params.concat([pageSize, offset]), function (err, rows) {
            if (err) {
                console.error(err);
                res.status(500).send('服务器错误');
                return;
            }
            res.json({ total, page, pageSize, rows });
        });
    });
});

// 数据概览
app.get('/nuclear_data/stats', function (req, res) {
    const sql = `SELECT COUNT(*) AS total,
                        DATE_FORMAT(MIN(date), '%Y-%m-%d') AS minDate,
                        DATE_FORMAT(MAX(date), '%Y-%m-%d') AS maxDate,
                        MAX(time) AS lastTime
                 FROM nuclear_data`;
    pool.query(sql, function (err, rows) {
        if (err) {
            console.error(err);
            res.status(500).send('服务器错误');
            return;
        }
        pool.query(`SELECT type, COUNT(*) AS cnt FROM nuclear_data GROUP BY type`, function (err, types) {
            if (err) {
                console.error(err);
                res.status(500).send('服务器错误');
                return;
            }
            res.json(Object.assign({}, rows[0], { types }));
        });
    });
});

function isValidDateStr(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function toFiniteNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function serve() {
    // 启动服务器
    app.listen(port, function () {
        console.log('Server is running on port ' + port);
    });
}

module.exports = {
    serve,
}