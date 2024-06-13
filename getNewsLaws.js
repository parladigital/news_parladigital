const puppeteer = require('puppeteer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Função para mapear os meses
function getMonthNumber(month) {
    const months = {
        'janeiro': '01',
        'fevereiro': '02',
        'março': '03',
        'abril': '04',
        'maio': '05',
        'junho': '06',
        'julho': '07',
        'agosto': '08',
        'setembro': '09',
        'outubro': '10',
        'novembro': '11',
        'dezembro': '12'
    };
    return months[month.toLowerCase()];
}

async function scrapeNews() {
    const browser = await puppeteer.launch({ headless: true });
    const credentialsPath = path.join(__dirname, 'api', 'electric-wave-426309-u0-1bd8b45883b7.json');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = '1BtE0RhK8AHlDWru9kt8MhI2mwQtS6RSU4_B9BYkTVkg';
    const rangeName = 'news_labor_rights!A2:E';
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    console.log('Scraping CNN Brasil...');
    await scrapeSite(browser, 'https://www.cnnbrasil.com.br/tudo-sobre/leis-trabalhistas/', 'a.home__list__tag', 'h1.post__title', 'span.post__data', 'div.post__content', 'CNN Brasil', sheets, spreadsheetId, rangeName, sixMonthsAgo);

    console.log('Scraping G1...');
    await scrapeSite(browser, 'https://g1.globo.com/tudo-sobre/clt/', 'a.feed-post-link', 'h1.content-head__title', 'time', 'div.mc-article-body', 'G1', sheets, spreadsheetId, rangeName, sixMonthsAgo);

    console.log('Scraping Exame...');
    await scrapeExame(browser, sheets, spreadsheetId, rangeName, sixMonthsAgo);

    await browser.close();
    console.log('Scraping completed.');
}

async function scrapeExame(browser, sheets, spreadsheetId, rangeName, sixMonthsAgo) {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');
    
    // Adicionar cabeçalhos extras para simular um navegador real
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': 'https://www.google.com/',
        'Upgrade-Insecure-Requests': '1'
    });

    const url = "https://exame.com/noticias-sobre/direitos-trabalhistas/";
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    // Esperar um elemento específico para garantir que a página seja carregada
    try {
        await page.waitForSelector('a.touch-area', { timeout: 15000 });
        console.log('Exame page loaded: true');
    } catch (e) {
        console.log('Exame page loaded: false');
        console.error('Exame page not loaded properly');
        return;
    }

    const newsLinks = await page.$$eval('a.touch-area', links => links.map(link => link.href));
    console.log('Exame news links found:', newsLinks.length);

    for (const newsUrl of newsLinks) {
        await page.goto(newsUrl, { waitUntil: 'networkidle2' });
        await delay(3000);

        const [title, dateStr, content] = await page.evaluate(() => {
            const title = document.querySelector('h1.headline-large')?.innerText.trim();
            const dateElement = document.querySelector('p.body-small');
            let dateStr = dateElement ? dateElement.innerText.trim() : '';
            if (dateStr) {
                const getMonthNumber = (month) => {
                    const months = {
                        'janeiro': '01',
                        'fevereiro': '02',
                        'março': '03',
                        'abril': '04',
                        'maio': '05',
                        'junho': '06',
                        'julho': '07',
                        'agosto': '08',
                        'setembro': '09',
                        'outubro': '10',
                        'novembro': '11',
                        'dezembro': '12'
                    };
                    return months[month.toLowerCase()];
                };
                const match = dateStr.match(/Publicado em (\d{1,2}) de (\w+) de (\d{4}) às (\d{2}h\d{2})/);
                if (match) {
                    const [day, month, year] = [match[1], getMonthNumber(match[2]), match[3]];
                    dateStr = `${year}-${month}-${day}`;
                }
            }
            const content = document.querySelector('div#news-body')?.innerText.trim();
            return [title, dateStr, content];
        });

        const newsDate = new Date(dateStr);
        if (newsDate >= sixMonthsAgo) {
            const values = [['Exame', `${newsDate.getDate()}/${newsDate.getMonth() + 1}/${newsDate.getFullYear()}`, newsUrl, title, content]];
            const request = {
                spreadsheetId,
                range: rangeName,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            };
            await sheets.spreadsheets.values.append(request);
        }
    }
}

async function scrapeSite(browser, url, linkSelector, titleSelector, dateSelector, contentSelector, source, sheets, spreadsheetId, rangeName, sixMonthsAgo) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await delay(5000);

    const newsLinks = await page.$$eval(linkSelector, links => links.map(link => link.href));
    console.log(`${source} news links found:`, newsLinks.length);

    for (const newsUrl of newsLinks) {
        await page.goto(newsUrl, { waitUntil: 'networkidle2' });
        await delay(3000);

        const [title, dateStr, content] = await page.evaluate((titleSelector, dateSelector, contentSelector) => {
            const title = document.querySelector(titleSelector)?.innerText.trim();
            const dateStr = document.querySelector(dateSelector)?.getAttribute('datetime') || document.querySelector(dateSelector)?.innerText.trim().split(' ')[0];
            const content = document.querySelector(contentSelector)?.innerText.trim();
            return [title, dateStr, content];
        }, titleSelector, dateSelector, contentSelector);

        const newsDate = new Date(dateStr.split('/').reverse().join('-'));
        if (newsDate >= sixMonthsAgo) {
            const values = [[source, `${newsDate.getDate()}/${newsDate.getMonth() + 1}/${newsDate.getFullYear()}`, newsUrl, title, content]];
            const request = {
                spreadsheetId,
                range: rangeName,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            };
            await sheets.spreadsheets.values.append(request);
        }
    }
}

function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

scrapeNews();
