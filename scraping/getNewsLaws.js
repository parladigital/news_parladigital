const puppeteer = require('puppeteer');
const { google } = require('googleapis');
const config = require('./config/scrapeConfigLaws.json'); // Garanta que o caminho está correto

// Função para interpretar diferentes formatos de datas
function parseDate(dateStr) {
    let date = new Date(dateStr);
    if (!isNaN(date)) return date;

    if (dateStr.includes('às')) {
        let parts = dateStr.split(' às ')[0].split('/');
        date = new Date(parts[2], parts[1] - 1, parts[0]);
        if (!isNaN(date)) return date;
    } else if (dateStr.includes('Publicado em')) {
        let parts = dateStr.match(/(\d{1,2}) de (\w+) de (\d{4})/);
        if (parts) {
            const months = {
                janeiro: 0, fevereiro: 1, março: 2, abril: 3, maio: 4, junho: 5,
                julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
            };
            date = new Date(parts[3], months[parts[2].toLowerCase()], parts[1]);
            if (!isNaN(date)) return date;
        }
    }
    return 'Invalid Date';
}

async function scrapeNews() {
    const browser = await puppeteer.launch({
        headless: true,
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
        return res.data.values ? res.data.values.map(row => row[2]) : [];
    } catch (error) {
        console.error('Failed to fetch existing news:', error);
        return [];
    }
}

async function scrapeSite(browser, site, sheets, sixMonthsAgo, existingNews) {
    const page = await browser.newPage();
    console.log(`Navigating to ${site.url}`);
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 90000 });

    try {
        await page.waitForSelector(site.linkSelector, { timeout: 30000 });
        const newsLinks = await page.$$eval(site.linkSelector, links => links.map(link => link.href));
        console.log(`${site.name} news links found:`, newsLinks.length);

        for (const newsUrl of newsLinks) {
            if (existingNews.includes(newsUrl)) {
                console.log(`Skipping duplicate news: ${newsUrl}`);
                continue;
            }
            console.log(`Processing news URL: ${newsUrl}`);
            await page.goto(newsUrl, { waitUntil: 'networkidle2', timeout: 90000 });
            await page.waitForTimeout(3000);

            const [title, dateStr, content] = await page.evaluate((site) => {
                const title = document.querySelector(site.titleSelector)?.innerText.trim();
                const dateElement = document.querySelector(site.dateSelector);
                const dateStr = dateElement ? dateElement.getAttribute('datetime') || dateElement.innerText.trim() : '';
                const content = document.querySelector(site.contentSelector)?.innerText.trim();
                return [title, dateStr, content];
            }, site);

            console.log(`Title: ${title}, Date: ${dateStr}, Content: ${content.substring(0, 50)}...`);

            const newsDate = parseDate(dateStr);
            console.log(`Converted Date: ${newsDate}`);
            if (newsDate != 'Invalid Date' && newsDate >= sixMonthsAgo) {
                const values = [[site.name, `${newsDate.getDate()}/${newsDate.getMonth() + 1}/${newsDate.getFullYear()}`, newsUrl, title, content]];
                const request = {
                    spreadsheetId: config.spreadsheetId,
                    range: config.rangeName,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                };
                await sheets.spreadsheets.values.append(request);
                console.log(`Data appended for ${site.name}`);
            } else {
                console.log(`News date is not within the last six months: ${newsDate}`);
            }
        }
    } catch (error) {
        console.error(`Failed to scrape site ${site.name}:`, error);
    }
}

scrapeNews();
