const fs = require('fs');
const content = fs.readFileSync('src/pages/Editorial.tsx', 'utf8');
const newContent = content.replace(/TEXTS\.global\.common\./g, 'TEXTS.comunidad.');
const newContent2 = newContent.replace(/\(word, i, arr\)/g, '(word: string, i: number, arr: string[])');
fs.writeFileSync('src/pages/Editorial.tsx', newContent2, 'utf8');

const detailContent = fs.readFileSync('src/pages/ArticleDetail.tsx', 'utf8');
const newDetail = detailContent.replace(/TEXTS\.global\.common\./g, 'TEXTS.comunidad.');
fs.writeFileSync('src/pages/ArticleDetail.tsx', newDetail, 'utf8');
