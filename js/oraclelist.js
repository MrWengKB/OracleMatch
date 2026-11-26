// 字库读取：从 oraclelist.csv 加载年级、课次和有甲骨文的汉字
//
// oraclelist.csv 由 tools/build_oraclelist.py 从 HanziQuery 的 hanzilist.csv 精简而来。
// 格式（第一行为表头，按表头名称识别各栏）：
//   年级,课次,生字,甲骨文字
//   一年级,第一课,二,二
//   二年级,第三课,马,馬
// 「甲骨文字」是甲骨文字体里实际放这个字形的字（这套字体多数字形放在繁体字的编码上）。
// 年级、课次的显示顺序 = 在文件中第一次出现的顺序。
//
// 加载结果 GRADES 的结构：
//   { "一年级": { "第一课": [{ char, oracle }, ...], ... }, ... }

const ORACLE_LIST_URL = 'oraclelist.csv';

const ORACLE_COLUMNS = {
    grade: ['年级'],
    lesson: ['课次'],
    char: ['生字', '汉字'],
    oracle: ['甲骨文字']
};

// 解析一行 csv（支持双引号包起来的字段）
function splitCsvLine(line) {
    const cols = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { cols.push(cur.trim()); cur = ''; }
        else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
}

function parseOracleCsv(text) {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return {};

    const header = splitCsvLine(lines[0]);
    const idx = {};
    for (const key in ORACLE_COLUMNS) {
        idx[key] = header.findIndex(h => ORACLE_COLUMNS[key].includes(h));
        if (idx[key] < 0) throw new Error(`oraclelist.csv 缺少“${ORACLE_COLUMNS[key][0]}”栏`);
    }

    const grades = {};
    for (const line of lines.slice(1)) {
        const cols = splitCsvLine(line);
        const grade = cols[idx.grade], lesson = cols[idx.lesson], char = cols[idx.char];
        const oracle = cols[idx.oracle] || char;
        if (!grade || !lesson || !char) continue;
        if (!grades[grade]) grades[grade] = {};
        if (!grades[grade][lesson]) grades[grade][lesson] = [];
        grades[grade][lesson].push({ char, oracle });
    }
    return grades;
}

async function loadOracleList(url = ORACLE_LIST_URL) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`读取 ${url} 失败（${res.status}）`);
    return parseOracleCsv(await res.text());
}

// 某个年级全部的字
function gradeWords(grades, grade) {
    let list = [];
    for (const lesson in (grades[grade] || {})) list = list.concat(grades[grade][lesson]);
    return list;
}

// 所有年级全部的字
function allWords(grades) {
    let list = [];
    for (const grade in grades) list = list.concat(gradeWords(grades, grade));
    return list;
}

// 页面直接用 file:// 打开时浏览器不允许读取 csv，给出提示
function oracleListErrorMessage(err) {
    if (location.protocol === 'file:') {
        return '无法读取字库 oraclelist.csv：直接双击打开网页时浏览器不允许读取文件。' +
            '请用网址（GitHub Pages）打开，或在文件夹里运行 python3 -m http.server 后访问 http://localhost:8000';
    }
    return '无法读取字库 oraclelist.csv：' + (err && err.message ? err.message : err);
}
