const puppeteer = require("puppeteer");
const { google } = require("googleapis");
const fs = require("fs");

const sites = [
  {
    name: "IoT Now",
    url: "https://www.iot-now.com/news/",
    linkSelector: "h2.category__title a",
    titleSelector: "h1.entry-title",
    dateSelector: "time.entry-date",
    contentSelector: "div.article__content",
    dateFormat: "text",
  },
  {
    name: "IoT For All",
    url: "https://www.iotforall.com/articles",
    linkSelector: "a.vari_filter_inner",
    titleSelector: "h1.ih1_seo_heading",
    dateSelector: "time.entry-date",
    contentSelector: "div.td-post-content",
    dateFormat: "text",
  },
  {
    name: "Exame",
    url: "https://exame.com/noticias-sobre/internet-das-coisas-iot/",
    linkSelector: "a.touch-area",
    titleSelector: "h1.headline-large",
    dateSelector: "p.body-small",
    contentSelector: "#news-body p, #news-body div",
    dateFormat: "Publicado em d mmmm yyyy às HH:mm",
  },
  {
    name: "Coin telegraph",
    url: "https://br.cointelegraph.com/tags/internet-of-things",
    linkSelector: "a.post-card-inline__title-link",
    titleSelector: "h1.post__title",
    dateSelector: ".post-meta__publish-date time",
    contentSelector: "div.post-content relative",
    dateFormat: "text",
  },
  {
    name: "IoT Business News",
    url: "https://iotbusinessnews.com/category/business-news/",
    linkSelector: ".cat-list-title a",
    titleSelector: "h1.entry-title",
    dateSelector: "div.entry-date",
    contentSelector: "div.entry-content",
    dateFormat: "text",
  },
  {
    name: "RCR Wireless News",
    url: "https://www.rcrwireless.com/internet-of-things",
    linkSelector: "h3.td-module-title a",
    titleSelector: "h1.tdb-title-text",
    dateSelector: "div.td-fix-index.td-module-date",
    contentSelector: "div.tdb-block-inner.td-fix-index",
    dateFormat: "text",
  },
];

async function scrapeNews() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
    defaultViewport: null,
    timeout: 300000, // Aumenta o timeout para 300 segundos
  });

  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = "1BtE0RhK8AHlDWru9kt8MhI2mwQtS6RSU4_B9BYkTVkg";
  const rangeName = "news_m2m_iot!A2:F";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const existingNews = await getExistingNews(sheets, spreadsheetId, rangeName);

  for (const site of sites) {
    console.log(`Scraping ${site.name}...`);
    try {
      await scrapeSite(
        browser,
        site,
        sheets,
        spreadsheetId,
        rangeName,
        yesterday,
        existingNews
      );
    } catch (error) {
      console.error(`Error scraping ${site.name}:`, error);
    }
  }

  await browser.close();
  console.log("Scraping completed.");
}

async function getExistingNews(sheets, spreadsheetId, rangeName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeName,
  });
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }
  return rows.map((row) => row[2]);
}

async function scrapeSite(
  browser,
  site,
  sheets,
  spreadsheetId,
  rangeName,
  yesterday,
  existingNews
) {
  const page = await browser.newPage();
  await page.goto(site.url, { waitUntil: "networkidle2", timeout: 90000 });
  await delay(5000);

  const newsLinks = await page.$$eval(site.linkSelector, (links) =>
    links.map((link) => link.href)
  );
  console.log(`${site.name} news links found:`, newsLinks.length);

  for (const newsUrl of newsLinks) {
    if (existingNews.includes(newsUrl)) {
      console.log(`Skipping duplicate news: ${newsUrl}`);
      continue;
    }

    try {
      await page.goto(newsUrl, { waitUntil: "networkidle2", timeout: 90000 });
      await delay(3000);

      const [title, dateStr, content] = await page.evaluate((site) => {
        function getMonthNumber(month) {
          const months = {
            janeiro: "01",
            fevereiro: "02",
            março: "03",
            abril: "04",
            maio: "05",
            junho: "06",
            julho: "07",
            agosto: "08",
            setembro: "09",
            outubro: "10",
            novembro: "11",
            dezembro: "12",
            jan: "01",
            feb: "02",
            mar: "03",
            apr: "04",
            may: "05",
            jun: "06",
            jul: "07",
            aug: "08",
            sep: "09",
            oct: "10",
            nov: "11",
            dec: "12",
            january: "01",
            february: "02",
            march: "03",
            april: "04",
            may: "05",
            june: "06",
            july: "07",
            august: "08",
            september: "09",
            october: "10",
            november: "11",
            december: "12",
          };
          return months[month.toLowerCase()];
        }

        const title = document
          .querySelector(site.titleSelector)
          ?.innerText.trim();
        let dateStr = document
          .querySelector(site.dateSelector)
          ?.innerText.trim();

        if (site.name === "IoT Now" || site.name === "IoT For All") {
          const match = dateStr.match(/(\w+) (\d{2}), (\d{4})/);
          if (match) {
            const [month, day, year] = [
              getMonthNumber(match[1]),
              match[2],
              match[3],
            ];
            dateStr = `${year}-${month}-${day}`;
          }
        } else if (site.name === "Exame") {
          const match = dateStr.match(
            /Publicado em (\d{1,2}) de (\w+) de (\d{4}) às (\d{2}h\d{2})/
          );
          if (match) {
            const [day, month, year] = [
              match[1],
              getMonthNumber(match[2]),
              match[3],
            ];
            dateStr = `${year}-${month}-${day}`;
          }
        } else if (site.name === "Coin telegraph") {
          const match = dateStr.match(/(\d{2}) (\w{3}) (\d{4})/);
          if (match) {
            const [day, month, year] = [
              match[1],
              getMonthNumber(match[2]),
              match[3],
            ];
            dateStr = `${year}-${month}-${day}`;
          }
        } else if (site.name === "Tec Mundo") {
          const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (match) {
            dateStr = `${match[3]}-${match[2]}-${match[1]}`;
          }
        }

        const content = Array.from(
          document.querySelectorAll(site.contentSelector)
        )
          .map((el) => el.innerText.trim())
          .join("\n");
        return [title, dateStr, content];
      }, site);

      console.log(
        `Processed news from ${newsUrl} with title: ${title} and date: ${dateStr}`
      );
      const newsDate = new Date(dateStr);
      if (isNaN(newsDate.getTime())) {
        console.log(
          `Skipping news from ${newsUrl} due to invalid date format: ${dateStr}`
        );
        continue;
      }

      console.log(`Converted news date: ${newsDate}`);
      if (newsDate >= yesterday) {
        if (content.length > 50000) {
          console.log(
            `Skipping news from ${newsUrl} due to content length exceeding 50000 characters.`
          );
          continue;
        }
        const now = new Date();
        const addedDate = `${now.getDate()}/${
          now.getMonth() + 1
        }/${now.getFullYear()}`;
        const values = [
          [
            site.name,
            `${newsDate.getDate()}/${
              newsDate.getMonth() + 1
            }/${newsDate.getFullYear()}`,
            addedDate,
            newsUrl,
            title,
            content,
          ],
        ];

        const request = {
          spreadsheetId,
          range: rangeName,
          valueInputOption: "USER_ENTERED",
          resource: { values },
        };
        await sheets.spreadsheets.values.append(request);
        console.log(`Added news to spreadsheet: ${title}`);
      } else {
        console.log(`News from ${newsUrl} is older than yesterday.`);
      }
    } catch (error) {
      console.error(`Error processing news article at ${newsUrl}:`, error);
    }
  }
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

scrapeNews();
