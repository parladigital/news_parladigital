const puppeteer = require('puppeteer');
const { google } = require('googleapis');
const config = require('../config/scrapeConfigLaws.json');

function parseDate(dateStr) {
    let date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;

    const months = {
        janeiro: '01', fevereiro: '02', março: '03', abril: '04', maio: '05', junho: '06',
        julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
    };
    const regex = /(\d{1,2}) de (\w+) de (\d{4})/;
    const matches = dateStr.match(regex);
    if (matches) {
        const year = matches[3];
        const month = months[matches[2].toLowerCase()];
        const day = matches[1];
        return new Date(`${year}-${month}-${day}`);
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
                const title = document.querySelector(site.titleSelector)?.innerText.trim() || 'No title found';
                const dateElement = document.querySelector(site.dateSelector);
                const dateStr = dateElement ? dateElement.innerText.trim() : 'No date found';
                const content = document.querySelector(site.contentSelector)?.innerText.trim() || 'No content found';
                return [title, dateStr, content];
            }, site);

            console.log(`Title: ${title}, Date: ${dateStr}, Content: ${content.substring(0, 50)}...`);

            const newsDate = parseDate(dateStr);
            console.log(`Converted Date: ${newsDate}`);
            if (newsDate !== 'Invalid Date' && newsDate >= sixMonthsAgo) {
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
