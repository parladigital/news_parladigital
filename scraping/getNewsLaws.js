const puppeteer = require('puppeteer');
const { google } = require('googleapis');
const config = require('./config/scrapeConfigLaws.json');  // Novo arquivo de configuração

async function scrapeNews() {
    const browser = await puppeteer.launch({
        headless: true,  // Corrigido para booleano
        args: ['--no-sandbox'],
        defaultViewport: null,
        timeout: 120000
    });

    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Buscar as notícias existentes na planilha
    const existingNews = await getExistingNews(sheets, config.spreadsheetId, config.rangeName);

    for (let site of config.sites) {
        console.log(`Scraping ${site.name}...`);
        await scrapeSite(browser, site, sheets, sixMonthsAgo, existingNews);
    }

    await browser.close();
    console.log('Scraping completed.');
}

async function getExistingNews(sheets, spreadsheetId, rangeName) {
    try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: rangeName });
        const rows = res.data.values;
        return rows ? rows.map(row => row[2]) : [];
    } catch (error) {
        console.error('Failed to fetch existing news:', error);
        return [];
    }
}

async function scrapeSite(browser, site, sheets, sixMonthsAgo, existingNews) {
    const page = await browser.newPage();
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(5000);

    const newsLinks = await page.$$eval(site.linkSelector, links => links.map(link => link.href));
    console.log(`${site.name} news links found:`, newsLinks.length);

    for (const newsUrl of newsLinks) {
        if (existingNews.includes(newsUrl)) {
            console.log(`Skipping duplicate news: ${newsUrl}`);
            continue;
        }

        await page.goto(newsUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await page.waitForTimeout(3000);

        const [title, dateStr, content] = await page.evaluate((site) => {
            const title = document.querySelector(site.titleSelector)?.innerText.trim();
            const dateStr = document.querySelector(site.dateSelector)?.getAttribute('datetime') || document.querySelector(site.dateSelector)?.innerText.trim();
            const content = document.querySelector(site.contentSelector)?.innerText.trim();
            return [title, dateStr, content];
        }, site);

        const newsDate = new Date(dateStr);
        if (newsDate >= sixMonthsAgo) {
            const values = [[site.name, `${newsDate.getDate()}/${newsDate.getMonth() + 1}/${newsDate.getFullYear()}`, newsUrl, title, content]];
            const request = {
                spreadsheetId: config.spreadsheetId,
                range: config.rangeName,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            };
            await sheets.spreadsheets.values.append(request);
        }
    }
}

async function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

scrapeNews();
